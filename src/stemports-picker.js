"use strict";

import React from "react";
import update from "immutability-helper";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Linking,
  ImageBackground
} from "react-native";
import { styles, Text, FixedMarkdown } from "./styles";
import {deserializeGame} from "./aris";
import {loadMedia, CacheMedia} from "./media";
import { StatusSpace } from "./status-space";
import { StemportsPlayer } from "./stemports-player";
import {saveInventoryZero} from './siftr-view';
import {loadQueue, uploadNote} from './upload-queue';
import {getQuestProgress} from './quests';
import {maxPickupDistance, meterDistance} from './map';
import { ComicView } from './stemports-player';
import { globalstyles } from "./global-styles";
import MapboxGL from "@react-native-mapbox-gl/maps";
import ModelView from '../react-native-3d-model-view/lib/ModelView';
import TestStyle from './mapbox-style.json';
import analytics from '@react-native-firebase/analytics';
import { MAP_PITCH } from "./constants";

MapboxGL.setAccessToken("pk.eyJ1IjoiZmllbGRkYXlsYWIiLCJhIjoiY2s3ejh3cHNrMDNtMTNlcnk2dmxnZzhidyJ9.-Kt-a2vKYZ49CjY_no1P9A");

const RNFS = require("react-native-fs");

function addTo(xs, f, offset = 1000000) {
  // make new object with sequential ID
  const new_id = offset + xs.length;
  xs.push(f(new_id));
  return new_id;
}

// polyfill for Array.flat, not needed for more recent iOS
const arrayFlat = function(xs, depth) {
  return xs.reduce(function(flat, toFlatten) {
    return flat.concat((Array.isArray(toFlatten) && (depth>1)) ? arrayFlat(toFlatten, depth-1) : toFlatten);
  }, []);
};

export class StemportsPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      games: [],
      downloadedGames: [],
      introSequence: 'comic1',
      gameModal: props.currentStation ? {
        game: props.currentStation,
        online: props.currentStation,
        offline: props.currentStation,
        distance: Infinity,
      } : undefined,
    };
  }

  componentDidMount() {
    RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/siftrs`, {NSURLIsExcludedFromBackupKey: true}).then(() => {
      this.getGames();
      this.loadDownloadedGames();
    });
    this.loadInventoryZero();
    loadQueue().then(notes => this.setState({queueNotes: notes}));
  }

  loadInventoryZero() {
    RNFS.readFile(`${RNFS.DocumentDirectoryPath}/siftrs/inventory-zero.txt`).then(str => {
      this.setState({inventory_zero: JSON.parse(str)});
    });
  }

  saveInventoryZero(new_inventory_zero, cb) {
    saveInventoryZero(new_inventory_zero, () =>
      this.setState({inventory_zero: new_inventory_zero}, cb)
    );
  }

  getGames() {
    this.props.auth.getAllStemportsStations(res => {
      if (res.returnCode === 0) {
        this.setState({games: res.data});
      }
    });
  }

  loadCurrentQuest() {
    return RNFS.readFile(`${RNFS.DocumentDirectoryPath}/siftrs/current-quest.txt`).then(str => {
      return JSON.parse(str);
    }).catch(() => {
      return null;
    });
  }

  loadDownloadedGames() {
    let gameToReload;
    this.setState(prevState => {
      gameToReload = prevState.gameModal;
      if (gameToReload) {
        return update(prevState, {gameModal: {$set: 'loading'}});
      } else {
        return prevState;
      }
    }, () => {
      this.loadCurrentQuest().then(currentQuest => {
        RNFS.readDir(`${RNFS.DocumentDirectoryPath}/siftrs`).then(items => {
          Promise.all(items.map(item => {
            return RNFS.exists(`${item.path}/download_timestamp.txt`).then(exist => {
              if (exist) {
                return Promise.all([
                  RNFS.readFile(`${item.path}/game.txt`),
                  RNFS.readFile(`${item.path}/quests.txt`),
                ]).then(([json, quests]) => {
                  const game = update(
                    deserializeGame(JSON.parse(json)),
                    {quests: {$set: JSON.parse(quests)}}
                  );
                  if (this.props.launchCurrentQuest && currentQuest && currentQuest.game_id === game.game_id) {
                    const quest = game.quests.find(q =>
                      parseInt(q.quest_id) === parseInt(currentQuest.quest_id)
                    );
                    if (quest) {
                      this.props.onSelect(game, quest);
                    }
                  }
                  this.setState(state => update(state, {downloadedGames: {$push: [game]}}));
                  return game;
                });
              } else {
                return null;
              }
            });
          })).then(games => {
            if (!gameToReload) return;
            let foundGame = false;
            games.forEach(game => {
              if (!game) return;
              if (parseInt(game.game_id) === parseInt(gameToReload.game.game_id)) {
                this.setState({gameModal: update(gameToReload, {offline: {$set: game}})});
                foundGame = true;
              }
            });
            if (!foundGame) {
              // probably shouldn't happen, but just to make sure spinner goes away
              this.setState({gameModal: null});
            }
          });
        });
      }).finally(() => {
        this.setState({doneLoadingQuests: true});
      });
    });
  }

  uploadGame(game) {
    const siftrDir = `${RNFS.DocumentDirectoryPath}/siftrs/${game.game_id}`;
    return Promise.all([
      Promise.all([
        RNFS.readFile(`${RNFS.DocumentDirectoryPath}/siftrs/inventory-zero.txt`),
        RNFS.readFile(`${siftrDir}/inventory.txt`),
      ]).then(([inv0, inv]) => {
        const instances = JSON.parse(inv0).concat(JSON.parse(inv));
        return Promise.all(instances.map(inst =>
          this.props.auth.promise('call', 'client.setQtyForInstance', {
            instance_id: inst.instance_id,
            qty: inst.qty,
          })
        ));
      }),
      RNFS.readFile(`${siftrDir}/logs.txt`).then(str => {
        const logs = JSON.parse(str);
        return Promise.all(logs.map(log => {
          if (parseInt(log.user_log_id)) {
            return null;
          } else if (log.event_type === 'VIEW_PLAQUE') {
            return this.props.auth.promise('call', 'client.logPlayerViewedContent', {
              game_id: game.game_id,
              content_type: 'PLAQUE',
              content_id: log.content_id,
            });
          } else if (log.event_type === 'COMPLETE_QUEST') {
            return this.props.auth.promise('call', 'client.logPlayerCompletedQuest', {
              game_id: game.game_id,
              quest_id: log.content_id,
            });
          } else {
            return null;
          }
        }).filter(x => x));
      }),
    ]);
  }

  initializeGame(game, hasOffline) {
    const siftrDir = `${RNFS.DocumentDirectoryPath}/siftrs/${game.game_id}`;
    return new Promise((resolve, reject) => {
      this.setState({downloadingGame: game}, resolve);
    }).then(() => RNFS.mkdir(siftrDir, {NSURLIsExcludedFromBackupKey: true})).then(() => {
      const writeJSON = (name) => {
        return (data) => {
          return RNFS.writeFile(
            `${siftrDir}/${name}.txt`,
            JSON.stringify(data)
          ).then(() =>
            ({key: name, data: data}) // return object to generate quests
          );
        };
      }
      return Promise.all([

        this.props.auth.promise('call', 'plaques.getPlaquesForGame', {
          game_id: game.game_id,
        }).then(writeJSON('plaques')),

        this.props.auth.promise('call', 'items.getItemsForGame', {
          game_id: game.game_id,
        }).then(writeJSON('items')),

        this.props.auth.promise('getTagsForGame', {
          game_id: game.game_id,
        }).then(writeJSON('tags')),

        this.props.auth.promise('call', 'tags.getObjectTagsForGame', {
          game_id: game.game_id,
        }).then(writeJSON('object_tags')),

        this.props.auth.promise('call', 'quests.getQuestsForGame', {
          game_id: game.game_id,
        }).then(writeJSON('quests')),

        this.props.auth.promise('call', 'requirements.getRequirementRootPackagesForGame', {
          game_id: game.game_id,
        }).then(writeJSON('requirement_root_packages')),

        this.props.auth.promise('call', 'requirements.getRequirementAndPackagesForGame', {
          game_id: game.game_id,
        }).then(writeJSON('requirement_and_packages')),

        this.props.auth.promise('call', 'requirements.getRequirementAtomsForGame', {
          game_id: game.game_id,
        }).then(writeJSON('requirement_atoms')),

        this.props.auth.promise('call', 'client.touchItemsForPlayer', {
          game_id: game.game_id,
        }).then(() =>
          this.props.auth.promise('call', 'instances.getInstancesForGame', {
            game_id: game.game_id,
            owner_id: this.props.auth.authToken.user_id,
          })
        ).then(writeJSON('inventory')),

        // upload the game-0 inventory for photos/snacks/etc.
        // then download it, including any missing instances
        this.props.auth.promise('call', 'client.touchItemsForPlayer', {
          game_id: 0,
        }).then(() =>
          RNFS.readFile(
            `${RNFS.DocumentDirectoryPath}/siftrs/inventory-zero.txt`
          ).catch(() => '[]')
        ).then((inv0) => {
          const instances = JSON.parse(inv0);
          return Promise.all(instances.map(inst =>
            this.props.auth.promise('call', 'client.setQtyForInstance', {
              instance_id: inst.instance_id,
              qty: inst.qty,
            })
          ));
        }).then(() =>
          this.props.auth.promise('call', 'instances.getInstancesForGame', {
            game_id: 0,
            owner_id: this.props.auth.authToken.user_id,
          })
        ).then(data => new Promise((resolve, reject) =>
          this.saveInventoryZero(data, resolve)
        )),

        this.props.auth.promise('call', 'instances.getInstancesForGame', {
          game_id: game.game_id,
        }).then(writeJSON('instances')),

        this.props.auth.promise('call', 'client.getLogsForPlayer', {
          game_id: game.game_id,
        }).then(writeJSON('logs')),

        this.props.auth.promise('call', 'factories.getFactoriesForGame', {
          game_id: game.game_id,
        }).then(writeJSON('factories')),

        this.props.auth.promise('call', 'triggers.getTriggersForGame', {
          game_id: game.game_id,
        }).then(writeJSON('triggers')),

        this.props.auth.promise('getFieldsForGame', {
          game_id: game.game_id,
        }).then(obj =>
          Promise.all([
            writeJSON('fields')(obj.fields),
            writeJSON('guides')(obj.guides),
          ])
        ),

        this.props.auth.promise('getUsersForGame', {
          game_id: game.game_id,
        }).then(writeJSON('authors')),

        this.props.auth.promise('getTheme', {
          theme_id: game.theme_id != null ? game.theme_id : 1,
        }).then(writeJSON('theme')),

        this.props.auth.promise('getColors', {
          colors_id: game.colors_id != null ? game.colors_id : 1,
        }).then(writeJSON('colors')),

        this.props.auth.promise('call', 'events.getEventsForGame', {
          game_id: game.game_id,
        }).then(writeJSON('events')),

        this.props.auth.promise('call', 'events.getEventPackagesForGame', {
          game_id: game.game_id,
        }).then(writeJSON('event_packages')),

        this.props.auth.promise('siftrSearch', {
          game_id: game.game_id,
          order: "recent",
          map_data: false,
        }).then(({notes}) =>
          Promise.all(notes.map(note => this.props.auth.promise('getFieldDataForNote', {
            note_id: note.note_id,
          }))).then(field_data => {
            return writeJSON('notes')(notes.map((note, i) =>
              update(note, {field_data: {$set: field_data[i]}})
            ));
          })
        ),

        this.props.auth.promise('call', 'media.getMediaForGame', {
          game_id: game.game_id,
        }).then(medias =>
          Promise.all(medias.map(media => new Promise((resolve, reject) => {
            loadMedia({
              media_id: media.media_id,
              auth: this.props.auth,
            }, resolve);
          })))
        ),

        writeJSON('game')(game),

      ]).then(objs => {
        // organize the data we got for the game
        let allData = {};
        objs.forEach(o => {
          arrayFlat([o], Infinity).forEach(x => {
            if (x && x.key) {
              allData[x.key] = x.data;
            }
          });
        });

        // generate quests

        /*
        for each quest that is referred to by at least one guide's quest_id:
          make a "get the remnants" quest
          make a "do observations" quest
        */

        let new_quests = [];
        let new_requirement_root_packages = [];
        let new_requirement_and_packages = [];
        let new_requirement_atoms = [];
        allData.quests.forEach(quest => {
          const guides = allData.guides.filter(guide =>
            parseInt(guide.quest_id) === parseInt(quest.quest_id)
          );
          if (guides.length > 0) {
            const fields = guides.map(guide =>
              allData.fields.find(field => parseInt(field.field_id) === parseInt(guide.field_id))
            );
            const stops = allData.plaques.filter(plaque =>
              !(plaque.quest_id) || parseInt(plaque.quest_id) === parseInt(quest.quest_id)
            );

            // make the "get the remnants" subquest
            const remnant_root_id = addTo(new_requirement_root_packages, root_id => ({
              requirement_root_package_id: root_id,
              game_id: game.game_id,
            }));
            const remnant_and_id = addTo(new_requirement_and_packages, and_id => ({
              requirement_and_package_id: and_id,
              game_id: game.game_id,
              requirement_root_package_id: remnant_root_id,
            }));
            fields.forEach(field => {
              field.options.forEach(opt =>
                addTo(new_requirement_atoms, atom_id => ({
                  requirement_atom_id: atom_id,
                  game_id: game.game_id,
                  requirement_and_package_id: remnant_and_id,
                  bool_operator: 1,
                  requirement: 'PLAYER_HAS_ITEM',
                  content_id: opt.remnant_id,
                  qty: 1,
                }))
              );
            });
            stops.forEach(stop => {
              addTo(new_requirement_atoms, atom_id => ({
                requirement_atom_id: atom_id,
                game_id: game.game_id,
                requirement_and_package_id: remnant_and_id,
                bool_operator: 1,
                requirement: 'PLAYER_VIEWED_PLAQUE',
                content_id: stop.plaque_id,
              }));
            });
            addTo(new_quests, quest_id => ({
              quest_id: quest_id,
              game_id: game.game_id,
              name: 'Collect',
              description: `Collect the ${quest.name} field notes and visit the stops.`,
              prompt: 'Start collecting notes and visiting the tour stops!',
              stars: 0,
              quest_type: 'QUEST',
              parent_quest_id: quest.quest_id,
              active_requirement_root_package_id: 0,
              complete_requirement_root_package_id: remnant_root_id,
            }));

            // make the "do observations" subquest
            const observe_root_id = addTo(new_requirement_root_packages, root_id => ({
              requirement_root_package_id: root_id,
              game_id: game.game_id,
            }));
            const observe_and_id = addTo(new_requirement_and_packages, and_id => ({
              requirement_and_package_id: and_id,
              game_id: game.game_id,
              requirement_root_package_id: observe_root_id,
            }));
            let needObservations = parseInt(quest.stars);
            if (!needObservations || needObservations < 1) {
              needObservations = 3;
            }
            addTo(new_requirement_atoms, atom_id => ({
              requirement_atom_id: atom_id,
              game_id: game.game_id,
              requirement_and_package_id: observe_and_id,
              bool_operator: 1,
              requirement: 'PLAYER_HAS_NOTE_WITH_QUEST', // custom req type
              content_id: quest.quest_id,
              qty: needObservations,
            }))
            const plural = needObservations === 1 ? 'an observation' : `${needObservations} observations`
            let prompt = `Now you are ready to make ${plural} of your own to complete the quest. Use the plus button to make an observation!`;
            if (quest.prompt) prompt = quest.prompt;
            addTo(new_quests, quest_id => ({
              quest_id: quest_id,
              game_id: game.game_id,
              name: 'Observe',
              description: `Make ${plural} with ${quest.name} field notes.`,
              prompt: prompt,
              stars: 0,
              quest_type: 'QUEST',
              parent_quest_id: quest.quest_id,
              active_requirement_root_package_id: 0,
              complete_requirement_root_package_id: observe_root_id,
            }));
          }
        });

        /*
        for each item trigger within range of a plaque trigger:
          add a req to the item trigger for the player to have been within range of the plaque (IN_PLAQUE_RANGE log entry)
          (if multiple, pick the closest plaque)
        */
        /*
        let instanceLookup = {};
        allData.instances.forEach(instance => {
          instanceLookup[instance.instance_id] = instance;
        });
        const plaqueTriggers = allData.triggers.filter(trigger =>
          instanceLookup[trigger.instance_id].object_type === 'PLAQUE'
        );
        const updatedTriggers = allData.triggers.map(trigger => {
          if (instanceLookup[trigger.instance_id].object_type === 'ITEM') {
            let closestPlaque = null;
            let closestDistance = maxPickupDistance;
            plaqueTriggers.forEach(otherTrigger => {
              const distance = meterDistance(trigger, otherTrigger);
              if (distance < closestDistance) {
                closestPlaque = otherTrigger;
                closestDistance = distance;
              }
            });
            if (closestPlaque) {
              // modify trigger so it's only visible after you go to closestPlaque
              if (parseInt(trigger.requirement_root_package_id)) {
                // already a requirement present, so we need to add our atom into that
                const attach_root_id = parseInt(trigger.requirement_root_package_id);
                const attach_and_id = allData.requirement_and_packages.find(and =>
                  parseInt(and.requirement_root_package_id) === attach_root_id
                ).requirement_and_package_id;
                addTo(new_requirement_atoms, atom_id => ({
                  requirement_atom_id: atom_id,
                  game_id: game.game_id,
                  requirement_and_package_id: attach_and_id,
                  bool_operator: 1,
                  requirement: 'PLAYER_BEEN_IN_PLAQUE_RANGE', // custom req type
                  content_id: instanceLookup[closestPlaque.instance_id].object_id,
                }))
                return trigger;
              } else {
                const attach_root_id = addTo(new_requirement_root_packages, root_id => ({
                  requirement_root_package_id: root_id,
                  game_id: game.game_id,
                }));
                const attach_and_id = addTo(new_requirement_and_packages, and_id => ({
                  requirement_and_package_id: and_id,
                  game_id: game.game_id,
                  requirement_root_package_id: attach_root_id,
                }));
                addTo(new_requirement_atoms, atom_id => ({
                  requirement_atom_id: atom_id,
                  game_id: game.game_id,
                  requirement_and_package_id: attach_and_id,
                  bool_operator: 1,
                  requirement: 'PLAYER_BEEN_IN_PLAQUE_RANGE', // custom req type
                  content_id: instanceLookup[closestPlaque.instance_id].object_id,
                }))
                return update(trigger, {
                  requirement_root_package_id: {
                    $set: attach_root_id,
                  },
                });
              }
            } else {
              return trigger;
            }
          } else {
            return trigger;
          }
        });
        */

        if (new_quests.length > 0) {
          return Promise.all([
            writeJSON('quests')(allData.quests.concat(new_quests)),
            writeJSON('requirement_root_packages')(allData.requirement_root_packages.concat(new_requirement_root_packages)),
            writeJSON('requirement_and_packages')(allData.requirement_and_packages.concat(new_requirement_and_packages)),
            writeJSON('requirement_atoms')(allData.requirement_atoms.concat(new_requirement_atoms)),
            // writeJSON('triggers')(updatedTriggers),
          ]).then(() => update(allData, {
            requirement_root_packages: {$push: new_requirement_root_packages},
            requirement_and_packages: {$push: new_requirement_and_packages},
            requirement_atoms: {$push: new_requirement_atoms},
            // triggers: {$set: updatedTriggers},
          }));
        } else {
          return allData; // nothing to do
        }

      }).then(allData => {
        // generate tags
        if (allData.tags.length === 0) {
          // generate tags and object_tags from remnants
          let new_tags = [];
          let new_object_tags = [];
          allData.guides.forEach(guide => {
            const field = allData.fields.find(field =>
              parseInt(field.field_id) === parseInt(guide.field_id)
            );
            if (!field) return;
            const tag_id = addTo(new_tags, tag_id => ({
              tag_id: tag_id,
              game_id: game.game_id,
              tag: field.label,
              media_id: 0,
              visible: 1,
              curated: 0,
              sort_index: 0,
              color: '',
              quest_id: guide.quest_id,
            }));
            field.options.forEach(opt => {
              addTo(new_object_tags, object_tag_id => ({
                object_tag_id: object_tag_id,
                game_id: game.game_id,
                object_type: 'ITEM',
                object_id: opt.remnant_id,
                tag_id: tag_id,
              }));
            });
          });

          return Promise.all([
            writeJSON('tags')(allData.tags.concat(new_tags)),
            writeJSON('object_tags')(allData.object_tags.concat(new_object_tags)),
          ]).then(() => allData);
        } else {
          return allData; // nothing to do
        }

      }).then(allData => {
        // generate factories
        if (allData.factories.length === 0) {
          // generate factories from remnants
          let new_factories = [];
          let new_instances = [];
          let new_triggers = [];
          let event_items = [];
          let new_requirement_root_packages = [];
          let new_requirement_and_packages = [];
          let new_requirement_atoms = [];
          allData.events.forEach(event => {
            if (event.event === 'GIVE_ITEM') { // GIVE_ITEM_PLAYER in database
              event_items[event.content_id] = true;
            }
          });
          let trigger_instances = {};
          allData.triggers.forEach(trigger => {
            trigger_instances[trigger.instance_id] = true;
          })
          allData.instances.forEach(instance => {
            if (instance.object_type === 'ITEM' && trigger_instances[instance.instance_id]) {
              event_items[instance.object_id] = true;
            }
          });
          allData.fields.forEach(field => {
            field.options.forEach(opt => {
              if (!opt.remnant_id) return;
              if (event_items[opt.remnant_id]) return;
              const factory_root_id = addTo(new_requirement_root_packages, root_id => ({
                requirement_root_package_id: root_id,
                game_id: game.game_id,
              }), 1500000);
              const factory_and_id = addTo(new_requirement_and_packages, and_id => ({
                requirement_and_package_id: and_id,
                game_id: game.game_id,
                requirement_root_package_id: factory_root_id,
              }), 1500000);
              addTo(new_requirement_atoms, atom_id => ({
                requirement_atom_id: atom_id,
                game_id: game.game_id,
                requirement_and_package_id: factory_and_id,
                bool_operator: 0,
                requirement: 'PLAYER_HAS_ITEM',
                content_id: opt.remnant_id,
                qty: 1,
              }), 1500000);
              const quest_id = parseInt(field.quest_id);
              if (quest_id) {
                addTo(new_requirement_atoms, atom_id => ({
                  requirement_atom_id: atom_id,
                  game_id: game.game_id,
                  requirement_and_package_id: factory_and_id,
                  bool_operator: 1,
                  requirement: 'PLAYER_IS_IN_QUEST',
                  content_id: quest_id,
                }), 1500000);
              }
              addTo(new_factories, factory_id => ({
                factory_id: factory_id,
                game_id: game.game_id,
                name: `Factory for item ${opt.remnant_id}`,
                object_type: 'ITEM',
                object_id: opt.remnant_id,
                seconds_per_production: 10,
                production_probability: 1,
                max_production: 1,
                produce_expiration_time: 60,
                produce_expire_on_view: 1,
                production_bound_type: 'PER_PLAYER',
                location_bound_type: 'PLAYER',
                min_production_distance: 10,
                max_production_distance: 20,
                requirement_root_package_id: factory_root_id, // was never used by aris! but we use to pass the id to trigger
                trigger_latitude: 0,
                trigger_longitude: 0,
                trigger_distance: 25,
                trigger_infinite_distance: 0,
                trigger_on_enter: 0,
                trigger_hidden: 0,
                trigger_wiggle: 0,
                trigger_title: '',
                trigger_icon_media_id: 0,
                trigger_show_title: 1,
                trigger_requirement_root_package_id: factory_root_id,
                trigger_scene_id: 0,
              }));
            });
          });
          new_factories.forEach(fact => {
            addTo(new_instances, instance_id => ({
              instance_id: instance_id,
              game_id: game.game_id,
              object_type: 'FACTORY',
              object_id: fact.factory_id,
              qty: 1,
              infinite_qty: 1,
              factory_id: 0,
              owner_type: 'GAME_CONTENT',
              owner_id: 0,
              requirement_root_package_id: fact.requirement_root_package_id, // pass to trigger
            }));
          });
          new_instances.forEach(inst => {
            addTo(new_triggers, trigger_id => ({
              trigger_id: trigger_id,
              game_id: game.game_id,
              instance_id: inst.instance_id,
              scene_id: 1,
              requirement_root_package_id: inst.requirement_root_package_id,
              type: 'IMMEDIATE',
            }));
          });
          return Promise.all([
            writeJSON('factories')(allData.factories.concat(new_factories)),
            writeJSON('instances')(allData.instances.concat(new_instances)),
            writeJSON('triggers')(allData.triggers.concat(new_triggers)),
            writeJSON('requirement_root_packages')(allData.requirement_root_packages.concat(new_requirement_root_packages)),
            writeJSON('requirement_and_packages')(allData.requirement_and_packages.concat(new_requirement_and_packages)),
            writeJSON('requirement_atoms')(allData.requirement_atoms.concat(new_requirement_atoms)),
          ]);
        } else {
          return;
        }

      }).then(() => {
        this.setState({downloadingGame: null});
        return RNFS.writeFile(`${siftrDir}/download_timestamp.txt`, Date.now());
      });
    });
  }

  startSync() {
    analytics().logEvent('Sync',{
      station_name: this.props.game.name
    })
    if (this.state.queueNotes == null) return;
    if (this.state.syncing) return;
    this.setState({syncing: true}, () => {
      let promises = this.state.downloadedGames.map(game =>
        this.uploadGame(game).then(() => this.initializeGame(game, game))
      );
      const uploadNotes = (rem) => {
        if (rem.length === 0) {
          return new Promise((resolve, reject) => resolve());
        } else {
          return uploadNote(this.props.auth, rem[0]).then(() => {
            return uploadNotes(rem.slice(1));
          });
        }
      };
      promises.push(uploadNotes(this.state.queueNotes).then(() => {
        loadQueue().then(notes => this.setState({queueNotes: notes}));
      }));
      return Promise.all(promises).then(() => {
        this.props.onSyncNotes && this.props.onSyncNotes();
        this.setState({syncing: false});
        this.loadDownloadedGames();
      });
    });
  }

  startSyncGame(game) {
    if (this.state.syncing) return;
    this.setState({syncing: true}, () => {
      const promise = this.uploadGame(game).then(() => this.initializeGame(game, game));
      return promise.then(() => {
        this.setState({syncing: false});
        this.loadDownloadedGames();
      });
    });
  }

  render() {
    if (this.props.inSplash) {
      return (
        <ImageBackground
          source={require('../web/assets/img/splash.jpg')}
          style={{
            flex: 1,
            backgroundColor: 'black',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexDirection: 'column',
            paddingBottom: 20,
          }}
          imageStyle={{
            resizeMode: 'contain',
          }}
        >
          <TouchableOpacity onPress={this.props.onCloseSplash} style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 5,
            margin: 20,
            paddingLeft: 15,
            paddingRight: 15,
            shadowColor: '#5D0D0D',
            shadowOpacity: 0.3,
            shadowRadius: 6,
            shadowOffset: {height: 2},
          }}>
            <Text style={{
              color: 'rgb(99,112,51)',
              fontSize: 20,
              textTransform: 'uppercase',
              fontFamily: 'LeagueSpartan-Bold',
            }}>
              Begin
            </Text>
          </TouchableOpacity>
          {
            this.props.viewComic && (
              <TouchableOpacity onPress={this.props.onSkipTutorial} style={{
                backgroundColor: 'white',
                padding: 10,
                borderRadius: 5,
                margin: 20,
                paddingLeft: 15,
                paddingRight: 15,
                shadowColor: '#5D0D0D',
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: {height: 2},
              }}>
                <Text style={{
                  color: 'rgb(99,112,51)',
                  fontSize: 20,
                  textTransform: 'uppercase',
                  fontFamily: 'LeagueSpartan-Bold',
                }}>
                  Skip Tutorial
                </Text>
              </TouchableOpacity>
            )
          }
        </ImageBackground>
      );
    }

    if (this.props.viewComic) {
      if (this.state.introSequence === 'comic1') {
        return (
          <ComicView
            pages={[
              require('../web/assets/img/comic-tutorial/1.1.png'),
              require('../web/assets/img/comic-tutorial/1.2.png'),
              require('../web/assets/img/comic-tutorial/1.3.png'),
              require('../web/assets/img/comic-tutorial/1.4.png'),
              require('../web/assets/img/comic-tutorial/1.5.png'),
              require('../web/assets/img/comic-tutorial/1.6.png'),
              require('../web/assets/img/comic-tutorial/1.7.png'),
              require('../web/assets/img/comic-tutorial/1.8.png'),
              require('../web/assets/img/comic-tutorial/1.9.png'),
              require('../web/assets/img/comic-tutorial/1.10.png'),
              require('../web/assets/img/comic-tutorial/1.11.png'),
            ]}
            onClose={() => this.setState({introSequence: 'invitation'})}
          />
        );
      } else if (this.state.introSequence === 'comic2') {
        return (
          <ComicView
            pages={[
              require('../web/assets/img/comic-tutorial/2.1.png'),
              require('../web/assets/img/comic-tutorial/2.2.png'),
              require('../web/assets/img/comic-tutorial/2.3.png'),
              require('../web/assets/img/comic-tutorial/2.4.png'),
              require('../web/assets/img/comic-tutorial/2.5.png'),
              require('../web/assets/img/comic-tutorial/2.6.png'),
            ]}
            onClose={() => this.setState({introSequence: 'station'})}
          />
        );
      } else if (this.state.introSequence === 'comic3') {
        return (
          <ComicView
            pages={[
              require('../web/assets/img/comic-tutorial/3.1.png'),
              require('../web/assets/img/comic-tutorial/3.2.png'),
              require('../web/assets/img/comic-tutorial/3.3.png'),
              require('../web/assets/img/comic-tutorial/3.4.png'),
              require('../web/assets/img/comic-tutorial/3.5.png'),
              require('../web/assets/img/comic-tutorial/3.6.png'),
              require('../web/assets/img/comic-tutorial/3.7.png'),
            ]}
            onClose={() => this.setState({introSequence: 'quests'})}
          />
        );
      } else if (this.state.introSequence === 'quests') {
        return (
          <StemportsOutpost
            game={{
              game_id: 'tutorial',
              name: 'The Station',
            }}
            obj={{
              offline: {
                quests: [{
                  quest_id: 'tutorial',
                  name: 'Your First Quest',
                }],
              },
            }}
            auth={this.props.auth}
            onSync={() => null}
            onUpload={() => null}
            onDownload={() => null}
            onClose={() => null}
            onSelect={() => this.setState({introSequence: 'comic4'})}
            canSync={!this.state.syncing}
            downloadingGame={this.state.downloadingGame}
          />
        );
      } else if (this.state.introSequence === 'comic4') {
        if (this.downloadingTutorial) {
          return (
            <View style={{
              backgroundColor: 'white',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
            }}>
              <Text style={{
                margin: 20,
              }}>
                Downloading quest???
              </Text>
              <ActivityIndicator
                size="large"
                style={{
                  margin: 20,
                }}
              />
            </View>
          );
        }
        return (
          <ComicView
            pages={[
              require('../web/assets/img/comic-tutorial/4.1.png'),
              require('../web/assets/img/comic-tutorial/4.2.png'),
              require('../web/assets/img/comic-tutorial/4.3.png'),
            ]}
            onClose={() => {
              if (!this.downloadingTutorial) {
                this.downloadingTutorial = true;
                this.initializeGame({game_id: 100058}).then(() => {
                  this.downloadingTutorial = false;
                  this.props.onSelect({
                    game_id: 100058,
                    name: 'The Station',
                    latitude: this.props.location.coords.latitude,
                    longitude: this.props.location.coords.longitude,
                    newFormat: (() => true),
                  }, {
                    quest_id: 62027,
                    name: 'Tutorial',
                  });
                });
              }
            }}
          />
        );
      }
    }

    if (!this.state.doneLoadingQuests && this.props.launchCurrentQuest) {
      return null;
    }

    let games = {};
    this.state.games.forEach(g => {
      if (!games[g.game_id]) games[g.game_id] = {};
      games[g.game_id].online = g;
    });
    this.state.downloadedGames.forEach(g => {
      if (!games[g.game_id]) games[g.game_id] = {};
      games[g.game_id].offline = g;
    });
    let gameList = [];
    for (let game_id in games) {
      const obj = games[game_id];
      const game = obj.online || obj.offline;
      const distance = this.props.location ? meterDistance(game, this.props.location.coords) : Infinity;
      gameList.push(update(obj, {game: {$set: game}, distance: {$set: distance}}));
    }
    gameList = gameList.filter(o => o.game.quests.length > 0);

    const playerScreen = (
      <StemportsPlayer
        onClose={() => {
          if (this.props.mode === 'player') {
            this.props.onClose && this.props.onClose();
          } else {
            this.setState({player: false});
          }
        }}
        onLogout={this.props.onLogout}
        auth={this.props.auth}
        onChangePassword={this.props.onChangePassword}
        onEditProfile={this.props.onEditProfile}
        queueMessage={this.props.queueMessage}
        online={this.props.online}
        onSelect={this.props.onSelect}
        inventory_zero={this.state.inventory_zero}
        onSync={() => this.startSync()}
        syncMessage={
          this.state.syncing ? 'Syncing???' : (
            this.state.queueNotes && (
              `You have ${this.state.queueNotes.length} unsynced observations.`
            )
          )
        }
        canSync={this.state.queueNotes && !this.state.syncing}
        location={this.props.location}
        inQuest={this.props.inQuest}
        onToggleWarp={this.props.onToggleWarp}
        onResetProgress={this.props.onResetProgress}
        warpOn={this.props.warpOn}
        currentQuest={this.props.currentQuest}
        game={this.props.game}
        onReplayIntro={() => {
          this.setState({introSequence: 'comic1'});
          this.props.onReplayIntro && this.props.onReplayIntro();
        }}
      />
    );

    const questScreen = (
      <View style={{flex: 1, backgroundColor: 'white'}}>
        <TouchableOpacity onPress={this.props.onClose}>
          <Image
            source={require('../web/assets/img/back-arrow.png')}
            style={{
              resizeMode: 'contain',
              width: 108 * 0.25,
              height: 150 * 0.25,
              margin: 10,
            }}
          />
        </TouchableOpacity>
        <Text style={{margin: 10, fontSize: 25, fontWeight: 'bold'}}>
          My Quests
        </Text>
        <ScrollView style={{
          flex: 1,
          borderColor: 'black',
          borderTopWidth: 1,
        }}>
          {
            gameList.filter(o => o.offline).map(o =>
              <GameQuestList
                key={o.game.game_id}
                obj={o}
                game={o.game}
                onSelect={this.props.onSelect}
                downloaded={true}
              />
            )
          }
        </ScrollView>
      </View>
    );

    if (this.props.onlyDownloaded) {
      gameList = gameList.filter(o => o.offline);
    }

    if (this.props.mode === 'player') {
      return playerScreen;
    }

    if (!this.state.gameModal) {
      if (this.props.mode === 'quests') {
        return questScreen;
      }

      const gamesByDistance = gameList.slice(0);
      gamesByDistance.sort((a, b) => a.distance - b.distance);
      let atStation = null;
      if (gamesByDistance.length > 0 && gamesByDistance[0].distance < 100) {
        atStation = gamesByDistance[0];
      }

      if (this.props.mode !== 'list' && !this.state.listFromMap) {
        // show map
        const {height, width} = Dimensions.get('window');

        return (
          <View style={{flex: 1}}>

            {
              this.state.player && (
                <Modal transparent={true} animationType="slide" onRequestClose={() => this.setState({player: false})}>
                  <SafeAreaView style={{flex: 1}}>
                    {playerScreen}
                  </SafeAreaView>
                </Modal>
              )
            }

            <MapboxGL.MapView
              style={{flex: 1}}
              zoomEnabled={true}
              scrollEnabled={false}
              rotateEnabled={true}
              pitchEnabled={false}
              contentInset={[height * 0.45, 0, 0, 0]}
            >
              <MapboxGL.Camera
                defaultSettings={{
                  zoomLevel: 22,
                  centerCoordinate: (this.props.location && [
                    parseFloat(this.props.location.coords.longitude),
                    parseFloat(this.props.location.coords.latitude),
                  ]),
                  pitch: MAP_PITCH,
                }}
                pitch={MAP_PITCH}
                animationDuration={300}
                followUserLocation={true}
                followUserMode="normal"
                followPitch={MAP_PITCH}
                followZoomLevel={22}
              />
              {
                !this.props.viewComic && gameList.map(o =>
                  <MapboxGL.PointAnnotation
                    id={'' + o.game.game_id}
                    key={o.game.game_id}
                    coordinate={[parseFloat(o.game.longitude), parseFloat(o.game.latitude)]}
                    title={o.game.name}
                    anchor={{x: 0.5, y: 0.5}}
                    onSelected={() => this.setState({gameModal: o})}
                  >
                    <View>
                      <Image
                        source={require('../web/assets/img/stemports-icon-station_nopin.png')}
                        style={{
                          width: 250 * 0.5,
                          height: 316 * 0.5,
                        }}
                      />
                    </View>
                  </MapboxGL.PointAnnotation>
                )
              }
              {
                this.props.viewComic && this.state.introSequence === 'invitation' && (
                  <MapboxGL.PointAnnotation
                    id="invitation"
                    key="invitation"
                    coordinate={(this.props.location && [
                      parseFloat(this.props.location.coords.longitude),
                      parseFloat(this.props.location.coords.latitude),
                    ])}
                    title="Invitation"
                    anchor={{x: 0.5, y: 0.5}}
                    onSelected={() => this.setState({introSequence: 'comic2'})}
                  >
                    <View>
                      <Image
                        source={require('../web/assets/img/icon-chest.png')}
                        style={{
                          width: 92 * 0.5,
                          height: 76 * 0.5,
                        }}
                      />
                    </View>
                  </MapboxGL.PointAnnotation>
                )
              }
              {
                this.props.viewComic && this.state.introSequence === 'station' && (
                  <MapboxGL.PointAnnotation
                    id="intro-station"
                    key="intro-station"
                    coordinate={(this.props.location && [
                      parseFloat(this.props.location.coords.longitude),
                      parseFloat(this.props.location.coords.latitude),
                    ])}
                    title="The Station"
                    anchor={{x: 0.5, y: 0.5}}
                    onSelected={() => this.setState({introSequence: 'comic3'})}
                  >
                    <View>
                      <Image
                        source={require('../web/assets/img/stemports-icon-station_nopin.png')}
                        style={{
                          width: 250 * 0.5,
                          height: 316 * 0.5,
                        }}
                      />
                    </View>
                  </MapboxGL.PointAnnotation>
                )
              }
              <MapboxGL.UserLocation
                visible={true}
              />
              <MapboxGL.Style
                json={TestStyle}
              />
            </MapboxGL.MapView>

            {
              !this.props.viewComic && (
                <GuideLine
                  style={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    right: 10,
                  }}
                  text={atStation
                    ? `It looks like you're near the ${atStation.game.name} Research Station. Tap the station to start a quest!`
                    : "Find a Research Station to start a quest!"
                  }
                  button={atStation
                    ? undefined
                    : { label: 'Find Research Station'
                      , onPress: (() => this.setState({listFromMap: true}))
                      }
                  }
                  auth={this.props.auth}
                />
              )
            }
            {
              !this.props.viewComic && (
                <View pointerEvents="box-none" style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}>
                  <TouchableOpacity onPress={() =>
                    this.setState({player: true})
                  } style={{
                    margin: 10,
                  }}>
                    <Image
                      source={require('../web/assets/img/stemports-icon-home.png')}
                      style={{
                        width: 108 * 0.75,
                        height: 100 * 0.75,
                      }}
                    />
                  </TouchableOpacity>
                </View>
              )
            }
          </View>
        );
      }

      return (
        <ImageBackground
          source={require('../web/assets/img/station-bg.jpg')}
          style={{
            flex: 1,
            backgroundColor: 'black',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexDirection: 'column',
          }}
          imageStyle={{
            resizeMode: 'contain',
          }}
        >
          <View style={{flex: 1, margin: 5}}>
            <TouchableOpacity onPress={this.state.listFromMap
              ? (() => this.setState({listFromMap: false}))
              : this.props.onClose
            }>
              <Image
                source={require('../web/assets/img/back-arrow.png')}
                style={{
                  resizeMode: 'contain',
                  width: 138 * 0.25,
                  height: 180 * 0.25,
                }}
              />
            </TouchableOpacity>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 30, fontFamily: 'LeagueSpartan-Bold'}}>
                {
                  this.props.onlyDownloaded ? 'My Stations' : 'Research Stations'
                }
              </Text>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: 'white'}}>
                {
                  this.props.onlyDownloaded
                    ? "These are all the Research Stations you've downloaded quests from!"
                    : 'Here are the Research Stations closest to you:'
                }
              </Text>
            <ScrollView style={{flex: 1}}>
              {
                gamesByDistance.map(o =>
                  <TouchableOpacity
                    key={o.game.game_id}
                    style={{
                      margin: 13,
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 10,
                      shadowColor: 'black',
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      shadowOffset: {width: 0, height: 3},
                      backgroundColor: 'white',
                      borderRadius: 10,
                    }}
                    onPress={() => this.setState({gameModal: o})}
                  >
                    <Image
                      style={{
                        resizeMode: 'contain',
                        width: 250 * 0.5,
                        height: 316 * 0.5,
                      }}
                      source={require('../web/assets/img/stemports-icon-station_nopin.png')}
                    />
                    <View style={{flex: 1}}>
                      <Text style={{margin: 5, fontSize: 14, fontWeight: 'bold'}}>
                        {o.game.name}
                      </Text>
                      <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                        <Text style={{color: 'rgb(120,136,150)', margin: 5, fontSize: 12}}>
                          {o.game.quests.length} {o.game.quests.length === 1 ? 'quest' : 'quests'}
                        </Text>
                        <Text style={{color: 'rgb(120,136,150)', margin: 5, fontSize: 12}}>
                          |
                        </Text>
                        <Text style={{color: 'rgb(120,136,150)', margin: 5, fontSize: 12}}>
                          {(o.distance / 1000).toFixed(2)} km away
                        </Text>
                      </View>
                      <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                        <TouchableOpacity onPress={() =>
                          Linking.openURL(`maps:0,0?q=${o.game.name}@${o.game.latitude},${o.game.longitude}`)
                          // TODO on Android this link should look different,
                          // see https://stackoverflow.com/a/48006762
                        }>
                          <Text style={{color: 'rgb(100,112,51)', margin: 5}}>
                            Map it
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              }
            </ScrollView>
          </View>
        </ImageBackground>
      );
    }

    return (
      <View style={{flex: 1}}>
        {
          this.state.gameModal && (() => {
            const obj = this.state.gameModal;
            if (obj === 'loading') {
              return (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  backgroundColor: 'white',
                }}>
                  <ActivityIndicator
                    size="large"
                    color="black"
                  />
                </View>
              );
            }
            const game = obj.game;
            return (
              <StemportsOutpost
                game={game}
                obj={obj}
                auth={this.props.auth}
                onSync={() => this.startSyncGame(game)}
                onUpload={() => this.uploadGame(game).then(() => this.loadDownloadedGames())}
                onDownload={() => this.initializeGame(game, obj.offline).then(() => this.loadDownloadedGames())}
                onClose={() => this.setState({gameModal: null})}
                onSelect={this.props.onSelect}
                canSync={!this.state.syncing}
                downloadingGame={this.state.downloadingGame}
              />
            );
          })()
        }
      </View>
    );
  }
}

const animSpeed = 10; // ms per char

export class GuideLine extends React.Component {
  constructor(props) {
    super(props);
    this._isMounted = true;
    this.startAnimation(props.text, true);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.text !== prevProps.text) {
      this.startAnimation(this.props.text);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  startAnimation(text, firstRender = false) {
    if (!this._isMounted) return;
    if (this.animationID) clearTimeout(this.animationID);
    if (firstRender) {
      this.state = {
        chars: 0,
        text: text,
        eating: false,
      };
    } else {
      this.setState({
        chars: 0,
        text: text,
      });
    }
    this.animationID = setTimeout(this.continueAnimation.bind(this), animSpeed);
  }

  continueAnimation() {
    if (!this._isMounted) return;
    this.setState(prevState => {
      const newChars = prevState.chars + 2;
      if (newChars < prevState.text.length) {
        this.animationID = setTimeout(this.continueAnimation.bind(this), animSpeed);
      }
      return update(prevState, {chars: {$set: newChars}});
    });
  }

  eatSnack() {
    if (this.state.eating) return;
    this.setState({
      eating: true,
    }, () => {
      setTimeout((() => {
        this.setState({eating: false});
      }), 1500)
    })
  }

  render() {
    const puffinModel = (
      <CacheMedia
        media_id={this.state.eating ? 993 : 919}
        auth={this.props.auth}
        online={true}
        withURL={(url) =>
          <ModelView
            source={{
              zip: url,
            }}
            style={{
              width: 140 * 0.7,
              height: 172 * 0.7,
            }}
            autoPlay={true}
            scale={1}
            camera={{
              position: {
                x: 0.9, y: 0.5, z: 0.85,
              },
              lookAt: {
                x: 0, y: 0.4, z: 0.1,
              },
            }}
          />
        }
      />
    );

    return (
      <View style={this.props.style}>
        <View style={{flexDirection: 'row'}}>
          <View style={{
            flex: 1,
            backgroundColor: 'white',
            borderRadius: 5,
            paddingTop: 15,
            paddingBottom: 15,
            paddingLeft: 17,
            paddingRight: 15,
            alignItems: 'flex-start',
            width: 120 * 0.5,
            height: 'auto',
            marginTop: 15,
          }}>
          <Image
            source={require('../web/assets/img/text-triangle.png')}
            style={{
              position: 'absolute',
              width: 28,
              height: 28,
              top: '50%',
              right: -10,
              marginBottom: -14,
            }}
          />
            <Text style={{
              fontFamily: 'OpenSans-SemiBold',
            }}>
              {this.state.text.slice(0, this.state.chars)}
            </Text>
            {
              this.props.button ? (
                <TouchableOpacity onPress={this.props.button.onPress} style={{
                  backgroundColor: 'rgb(100,112,51)',
                  padding: 5,
                  borderRadius: 5,
                  marginTop: 10,
                  marginBottom: 10,
                }}>
                  <Text style={{color: 'white', fontFamily: 'OpenSans-SemiBold'}}>{this.props.button.label}</Text>
                </TouchableOpacity>
              ) : null
            }
          </View>
          {
            this.props.onPress ? (
              <TouchableOpacity style={{margin: 10}} onPress={this.props.onPress}>
                {puffinModel}
              </TouchableOpacity>
            ) : (
              puffinModel
            )
          }
        </View>
      </View>
    );
  }
}

class GameQuestList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount() {
    const siftrDir = `${RNFS.DocumentDirectoryPath}/siftrs/${this.props.game.game_id}`;
    RNFS.readFile(`${siftrDir}/quests-sorted.txt`).then(str => {
      this.setState({sortedQuests: JSON.parse(str)});
    }).catch(() => {
      this.setState({sortedQuests: 'unknown'});
    });
  }

  render() {
    const obj = this.props.obj;

    if (this.props.skin === 'station') {
      return (
        <View>
          {
            (obj.offline ? obj.offline.quests : obj.online.quests).filter(quest =>
              !parseInt(quest.parent_quest_id)
            ).map(quest => {
              const details = this.state.sortedQuests &&
                this.state.sortedQuests.displayInfo &&
                this.state.sortedQuests.displayInfo.find(o =>
                  parseInt(o.quest.quest_id) === parseInt(quest.quest_id)
                );
              const progress = getQuestProgress(details);
              let done = 0;
              let total = 0;
              progress.forEach(sub => {
                done += sub.done;
                total += sub.total;
              });
              return (
                <View key={quest.quest_id} style={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  backgroundColor: 'white',
                  margin: 8,
                  marginLeft: 16,
                  marginRight: 16,
                  borderRadius: 8,
                  shadowColor: '#5D0D0D',
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  shadowOffset: {height: 2},
                }}>
                  <View key={quest.quest_id} style={{
                    flexDirection: 'row',
                    padding: 5,
                    alignItems: 'center',
                  }}>
                    {
                      parseInt(quest.active_icon_media_id) ? (
                        <CacheMedia
                          media_id={quest.active_icon_media_id}
                          auth={this.props.auth}
                          online={this.props.online}
                          withURL={(url) => (
                            <Image source={url} style={{
                              width: 40,
                              height: 40,
                              resizeMode: 'contain',
                              margin: 5,
                            }} />
                          )}
                        />
                      ) : (
                        <Image source={require('../web/assets/img/stemports-leaf.png')} style={{
                          width: 40,
                          height: 40,
                          resizeMode: 'contain',
                          margin: 5,
                        }} />
                      )
                    }
                    <Text style={{flex: 1, margin: 5}}>{quest.name}</Text>
                    {
                      this.props.downloaded && (
                        <TouchableOpacity onPress={() =>
                          obj.offline && this.props.onSelect(this.props.game, quest)
                        } style={{
                          borderColor: 'rgb(100,111,51)',
                          borderWidth: 2,
                          backgroundColor: done === 0 ? 'white' : 'rgb(100,111,51)',
                          margin: 5,
                          paddingTop: 5,
                          paddingBottom: 5,
                          paddingLeft: 9,
                          paddingRight: 9,
                          borderRadius: 5,
                        }}>
                          <Text style={{
                            color: done === 0 ? 'rgb(100,111,51)' : 'white',
                            fontFamily: 'LeagueSpartan-Bold',
                            letterSpacing: 1,
                            lineHeight: 20,
                            fontSize: 14,
                          }}>
                            {done === 0 ? 'Start' : 'Resume'}
                          </Text>
                        </TouchableOpacity>
                      )
                    }
                  </View>
                </View>
              );
            }).filter(x => x)
          }
        </View>
      );
    }

    return (
      <View>
        {
          (obj.offline ? obj.offline.quests : obj.online.quests).filter(quest =>
            !parseInt(quest.parent_quest_id)
          ).map(quest => {
            const details = this.state.sortedQuests &&
              this.state.sortedQuests.displayInfo &&
              this.state.sortedQuests.displayInfo.find(o =>
                parseInt(o.quest.quest_id) === parseInt(quest.quest_id)
              );
            const progress = getQuestProgress(details);
            let done = 0;
            let total = 0;
            progress.forEach(sub => {
              done += sub.done;
              total += sub.total;
            });
            return (
              <View key={quest.quest_id} style={{
                flexDirection: 'column',
                alignItems: 'stretch',
                borderColor: 'rgb(223,230,237)',
                borderBottomWidth: 2,
              }}>
                <View key={quest.quest_id} style={{
                  flexDirection: 'row',
                  padding: 5,
                  alignItems: 'center',
                }}>
                  <Image source={require('../web/assets/img/stemports-leaf.png')} style={{
                    width: 58 * 0.5,
                    height: 60 * 0.5,
                    resizeMode: 'contain',
                    margin: 5,
                  }} />
                  <Text style={{flex: 1, margin: 5}}>{quest.name}</Text>
                  {
                    this.props.downloaded && (
                      <TouchableOpacity onPress={() =>
                        obj.offline && this.props.onSelect(this.props.game, quest)
                      } style={{
                        backgroundColor: 'rgb(100,112,51)',
                        margin: 5,
                        paddingTop: 5,
                        paddingBottom: 5,
                        paddingLeft: 9,
                        paddingRight: 9,
                        borderRadius: 5,
                      }}>
                        <Text style={{color: 'white'}}>{done === 0 ? 'start' : 'resume'}</Text>
                      </TouchableOpacity>
                    )
                  }
                </View>
                {
                  done === 0 ? (
                    <View style={{
                      padding: 10,
                      alignItems: 'stretch',
                      flexDirection: 'row',
                    }}>
                      <View style={{
                        backgroundColor: 'rgb(211,217,223)',
                        height: 12,
                        flex: 1,
                        borderRadius: 4,
                      }} />
                    </View>
                  ) : done === total ? (
                    <View style={{
                      padding: 10,
                      alignItems: 'stretch',
                      flexDirection: 'row',
                    }}>
                      <View style={{
                        backgroundColor: 'rgb(66,82,96)',
                        height: 12,
                        flex: 1,
                        borderRadius: 4,
                      }} />
                    </View>
                  ) : (
                    <View style={{
                      padding: 10,
                      alignItems: 'stretch',
                      flexDirection: 'row',
                    }}>
                      <View style={{
                        backgroundColor: 'rgb(66,82,96)',
                        height: 12,
                        flex: done,
                        borderTopLeftRadius: 4,
                        borderBottomLeftRadius: 4,
                      }} />
                      <View style={{
                        backgroundColor: 'rgb(211,217,223)',
                        height: 12,
                        flex: total - done,
                        borderTopRightRadius: 4,
                        borderBottomRightRadius: 4,
                      }} />
                    </View>
                  )
                }
              </View>
            );
          }).filter(x => x)
        }
      </View>
    );
  }
}

class StemportsQuest extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  render() {
    return (
      <View style={{
        flex: 1,
        backgroundColor: 'white',
        alignItems: 'stretch',
      }}>
        <TouchableOpacity onPress={this.props.onClose}>
          <Image
            source={require('../web/assets/img/back-arrow.png')}
            style={{
              resizeMode: 'contain',
              width: 138 * 0.25,
              height: 180 * 0.25,
              marginLeft: 15,
            }}
          />
        </TouchableOpacity>
        <ScrollView style={{flex: 1}}>
          <Text style={{margin: 15, fontFamily: 'League Spartan', fontSize: 25, fontWeight: 'bold', flex: 1}}>
            {this.props.quest.name}
          </Text>
          {
            parseInt(this.props.quest.active_icon_media_id) ? (
              <CacheMedia
                media_id={this.props.quest.active_icon_media_id}
                auth={this.props.auth}
                online={this.props.online}
                withURL={(url) => (
                  <Image
                    source={url}
                    style={{
                      height: 300,
                      resizeMode: 'contain',
                      borderRadius: 10
                    }}
                  />
                )}
              />
            ) : null
          }
          {
            (this.props.quest.description && this.props.quest.description.length !== 0) ? (
              <View style={{margin: 15}}>
                <FixedMarkdown text={this.props.quest.description} />
              </View>
            ) : null
          }
        </ScrollView>
        <View style={{alignItems: 'center', justifyContent: 'center'}}>
          <TouchableOpacity style={{
            backgroundColor: 'rgb(97,132,63)',
            padding: 10,
            margin: 20,
            borderRadius: 5,
          }} onPress={this.props.onStart}>
            <Text style={{
              color: 'white',
              textTransform: 'uppercase',
              fontWeight: 'bold',
              fontFamily: 'League Spartan',
            }}>
              Start Quest
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

class StemportsOutpost extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showingQuest: null,
    };
  }

  componentDidMount() {
    analytics().logEvent('ViewStationQuestList', {
      station_name: this.props.game.name,
    });
  }
  render() {
    if (this.state.showingQuest) {
      return (
        <StemportsQuest
          onStart={() => this.props.onSelect(this.props.game, this.state.showingQuest)}
          onClose={() => this.setState({showingQuest: null})}
          quest={this.state.showingQuest}
        />
      );
    }

    const game = this.props.game;
    const obj = this.props.obj;
    const newVersion = obj.online && obj.offline && obj.online.version !== obj.offline.version;
    return (
      <View style={{
        flex: 1,
        backgroundColor: 'rgb(109,187,129)',
        alignItems: 'stretch',
      }}>
        <ScrollView style={{flex: 1}}>
          <View style={{
            backgroundColor: 'white',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Image source={require('../web/assets/img/stemports-icon-station_nopin.png')} style={{
                width: 250 * 0.4,
                height: 316 * 0.4,
                resizeMode: 'contain',
                margin: 15,
              }} />
              <Text style={{margin: 15, fontSize: 30, fontFamily: 'LeagueSpartan-Bold', flex: 1}}>
                {game.name}
              </Text>
            </View>
            {
              (game.description && game.description.length !== 0) ? (
                <View style={{margin: 15}}>
                  <FixedMarkdown text={game.description} />
                </View>
              ) : null
            }
          </View>
          {
            newVersion && (
              <View style={{
                padding: 15,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <View style={{flex: 1, marginRight: 10}}>
                  <Text style={{
                    margin: 3,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    color: "rgb(5,85,26)",
                    fontSize: 20,
                    fontFamily: 'LeagueSpartan-Bold',
                    letterSpacing: 2,
                    lineHeight: 25,
                  }}>
                    {this.props.canSync ? "Update\nAvailable" : 'Syncing???'}
                  </Text>
                </View>
                {
                  this.props.canSync && (
                    <TouchableOpacity onPress={this.props.onSync} style={{
                      backgroundColor: 'white',
                      padding: 10,
                      borderRadius: 4,
                      shadowColor: '#5D0D0D',
                      shadowOpacity: 0.3,
                      shadowRadius: 6,
                      shadowOffset: {height: 2},
                    }}>
                      <Text style={{color: 'black', textTransform: 'uppercase'}}>Update Quests</Text>
                    </TouchableOpacity>
                  )
                }
              </View>
            )
          }
          {
            !(obj.offline) && (
              <View style={{alignItems: 'center', padding: 15, flexDirection: 'row'}}>
                <View style={{flex: 1, marginRight: 10}}>
                  <Text style={{
                    margin: 3,
                    fontWeight: 'bold',
                    color: "rgb(5,85,26)",
                    fontSize: 18,
                    fontFamily: 'LeagueSpartan-Bold',
                    letterSpacing: 2,
                    lineHeight: 25,
                  }}>
                    {game.quests.length == 1 ? "1 Quest\n" : `${game.quests.length} Quests\n`}Available
                  </Text>
                </View>
                <TouchableOpacity style={{
                  backgroundColor: "rgb(6,85,26)",
                  padding: 10,
                  borderRadius: 4,
                }} onPress={this.props.downloadingGame ? undefined : this.props.onDownload}>
                  <Text style={{color: 'white', textTransform: 'uppercase', fontSize: 12}}>
                    {
                      this.props.downloadingGame ? (
                        parseInt(this.props.downloadingGame.game_id) == parseInt(game.game_id)
                          ? 'Downloading???'
                          : 'Please wait???'
                      ) : 'Download Quests'
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }
          <GameQuestList
            obj={obj}
            game={game}
            onSelect={(game, quest) => this.setState({showingQuest: quest})}
            downloaded={obj.offline}
            skin="station"
            auth={this.props.auth}
          />
        </ScrollView>
        <View style={globalstyles.closeContainer} pointerEvents="box-none">
          <TouchableOpacity onPress={this.props.onClose}>
            <Image
              style={globalstyles.closeButton}
              source={require("../web/assets/img/quest-close.png")}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
