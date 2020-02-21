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
  Linking
} from "react-native";
import { styles, Text } from "./styles";
import {deserializeGame} from "./aris";
import {loadMedia, CacheMedia} from "./media";
import { StatusSpace } from "./status-space";
import { StemportsPlayer } from "./stemports-player";
import MapView, {PROVIDER_GOOGLE} from 'react-native-maps';
import {addXP, meterDistance} from './siftr-view';
import {loadQueue, uploadNote} from './upload-queue';
import {getQuestProgress} from './quests';

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
    };
  }

  componentDidMount() {
    RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/siftrs`, {NSURLIsExcludedFromBackupKey: true}).then(() => {
      this.getGames(1, 0);
      this.loadDownloadedGames();
    });
    this.loadXP();
    loadQueue().then(notes => this.setState({queueNotes: notes}));
  }

  loadXP() {
    RNFS.readFile(`${RNFS.DocumentDirectoryPath}/siftrs/inventory-zero.txt`).then(str => {
      this.setState({inventory_zero: JSON.parse(str)});
    });
  }

  addXP(xp, inv, cb) {
    addXP(xp, inv, (new_inventory_zero) =>
      this.setState({inventory_zero: new_inventory_zero}, cb)
    );
  }

  getGames(game_id, missed) {
    if (missed >= 20) {
      return;
    }
    this.props.auth.getGame({game_id}, res => {
      if (res.returnCode === 0) {
        let game = res.data;
        this.props.auth.call('quests.getQuestsForGame', {game_id}, resQuests => {
          if (resQuests.returnCode === 0) {
            game = update(game, {quests: {$set: resQuests.data}});
          }
          this.setState(state => update(state, {games: {$push: [game]}}));
          this.getGames(game_id + 1, 0);
        });
      } else {
        this.getGames(game_id + 1, missed + 1);
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

        this.props.auth.promise('call', 'client.touchItemsForPlayer', {
          game_id: 0,
        }).then(() =>
          this.props.auth.promise('call', 'instances.getInstancesForGame', {
            game_id: 0,
            owner_id: this.props.auth.authToken.user_id,
          })
        ).then(data =>
          new Promise((resolve, reject) => this.addXP((hasOffline ? 0 : 2), data, resolve))
        ),

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
            addTo(new_quests, quest_id => ({
              quest_id: quest_id,
              game_id: game.game_id,
              name: 'Collect',
              description: `Collect the ${quest.name} field notes and visit the stops.`,
              prompt: `The first thing you need to do is collect the ${quest.name} field notes, and visit all the tour stops.`,
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
            addTo(new_requirement_atoms, atom_id => ({
              requirement_atom_id: atom_id,
              game_id: game.game_id,
              requirement_and_package_id: observe_and_id,
              bool_operator: 1,
              requirement: 'PLAYER_HAS_NOTE_WITH_QUEST', // custom req type
              content_id: quest.quest_id,
              qty: 3,
            }))
            let prompt = 'Now you are ready to make 3 observations of your own to complete the quest. Use the plus button to make an observation!';
            if (quest.prompt) prompt = quest.prompt;
            addTo(new_quests, quest_id => ({
              quest_id: quest_id,
              game_id: game.game_id,
              name: 'Observe',
              description: `Make 3 observations with ${quest.name} field notes.`,
              prompt: prompt,
              stars: 0,
              quest_type: 'QUEST',
              parent_quest_id: quest.quest_id,
              active_requirement_root_package_id: 0,
              complete_requirement_root_package_id: observe_root_id,
            }));
          }
        });

        if (new_quests.length > 0) {
          return Promise.all([
            writeJSON('quests')(allData.quests.concat(new_quests)),
            writeJSON('requirement_root_packages')(allData.requirement_root_packages.concat(new_requirement_root_packages)),
            writeJSON('requirement_and_packages')(allData.requirement_and_packages.concat(new_requirement_and_packages)),
            writeJSON('requirement_atoms')(allData.requirement_atoms.concat(new_requirement_atoms)),
          ]).then(() => update(allData, {
            requirement_root_packages: {$push: new_requirement_root_packages},
            requirement_and_packages: {$push: new_requirement_and_packages},
            requirement_atoms: {$push: new_requirement_atoms},
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
              event_items.push(parseInt(event.content_id));
            }
          });
          allData.fields.forEach(field => {
            field.options.forEach(opt => {
              if (!opt.remnant_id) return;
              if (event_items.indexOf(opt.remnant_id) !== -1) return;
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
                max_production: 2,
                produce_expiration_time: 60,
                produce_expire_on_view: 1,
                production_bound_type: 'PER_PLAYER',
                location_bound_type: 'PLAYER',
                min_production_distance: 10,
                max_production_distance: 40,
                requirement_root_package_id: 0,
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
            }));
          });
          new_instances.forEach(inst => {
            addTo(new_triggers, trigger_id => ({
              trigger_id: trigger_id,
              game_id: game.game_id,
              instance_id: inst.instance_id,
              scene_id: 1,
              requirement_root_package_id: 0,
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
        this.setState({syncing: false, gameModal: null});
        this.loadDownloadedGames();
      });
    });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (!this.refs.theMapView) return;
    if (!prevProps.location && !this.props.location) return;
    if ( prevProps.location
      && this.props.location
      && prevProps.location.coords.latitude === this.props.location.coords.latitude
      && prevProps.location.coords.longitude === this.props.location.coords.longitude
    ) return;

    this.refs.theMapView.setCamera({
      center: this.props.location.coords,
    });
  }

  render() {
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

    if (this.state.player || this.props.mode === 'player') {
      return (
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
            this.state.syncing ? 'Syncing…' : (
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
        />
      );
    }

    if (!this.state.gameModal) {
      if (this.props.mode === 'quests') {
        return (
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
      }

      if (this.props.mode !== 'list') {
        // show map
        const {height, width} = Dimensions.get('window');
        return (
          <View style={{flex: 1}}>
            <MapView
              provider={PROVIDER_GOOGLE}
              ref="theMapView"
              initialCamera={{
                center: this.props.location ? this.props.location.coords : {
                  latitude: 0,
                  longitude: 0,
                },
                heading: 0,
                pitch: 90,
                zoom: 20.5,
                altitude: 0, // not used
              }}
              showsUserLocation={true}
              showsBuildings={false}
              scrollEnabled={false}
              pitchEnabled={false}
              zoomEnabled={false}
              style={{flex: 1}}
              mapPadding={{
                top: height * 0.45,
              }}
            >
              {
                gameList.map(o =>
                  <MapView.Marker
                    key={o.game.game_id}
                    tracksViewChanges={false}
                    coordinate={{
                      latitude: parseFloat(o.game.latitude),
                      longitude: parseFloat(o.game.longitude),
                    }}
                    anchor={{x: 0.5, y: 0.5}}
                    title=""
                    description=""
                    pinColor="blue"
                    onPress={() => this.setState({gameModal: o})}
                    icon={require('../web/assets/img/icon-blaze.png')}
                  >
                    <MapView.Callout tooltip={true} />
                  </MapView.Marker>
                )
              }
            </MapView>
            <GuideLine
              style={{
                flexDirection: 'column',
                alignItems: 'stretch',
                position: 'absolute',
                top: 10,
                left: 10,
                right: 10,
              }}
              text="Find a science station to start a quest!"
            />
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
                padding: 8,
                backgroundColor: 'white',
                borderColor: 'black',
                borderWidth: 1,
                borderRadius: 5,
                margin: 10,
              }}>
                <Text>home</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      const gamesByDistance = gameList.slice(0);
      gamesByDistance.sort((a, b) => a.distance - b.distance);
      return (
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
            Science Stations
          </Text>
          <Text style={{margin: 10}}>
            Science stations are where the quests are! Here are the science stations closest to you:
          </Text>
          <ScrollView style={{flex: 1}}>
            {
              gamesByDistance.map(o =>
                <TouchableOpacity
                  key={o.game.game_id}
                  style={{
                    margin: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderColor: 'rgb(120,136,150)',
                    borderWidth: 2,
                    padding: 5,
                  }}
                  onPress={() => this.setState({gameModal: o})}
                >
                  <Image
                    style={{
                      resizeMode: 'contain',
                      width: 136 * 0.25,
                      height: 128 * 0.25,
                      margin: 15,
                    }}
                    source={require('../web/assets/img/stemports-home-station.png')}
                  />
                  <View style={{flex: 1}}>
                    <Text style={{margin: 5}}>
                      {o.game.name}
                    </Text>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                      <Text style={{color: 'rgb(120,136,150)', margin: 5}}>
                        {(o.distance / 1000).toFixed(2)} km away
                      </Text>
                      <Text style={{color: 'rgb(120,136,150)', margin: 5}}>
                        |
                      </Text>
                      <Text style={{color: 'rgb(120,136,150)', margin: 5}}>
                        {o.game.quests.length} {o.game.quests.length === 1 ? 'quest' : 'quests'}
                      </Text>
                      <Text style={{color: 'rgb(120,136,150)', margin: 5}}>
                        |
                      </Text>
                      <TouchableOpacity onPress={() =>
                        Linking.openURL(`maps:0,0?q=${o.game.name}@${o.game.latitude},${o.game.longitude}`)
                        // TODO on Android this link should look different,
                        // see https://stackoverflow.com/a/48006762
                      }>
                        <Text style={{color: 'rgb(101,88,245)', margin: 5}}>
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
      );
    }

    return (
      <View style={{flex: 1}}>
        {
          this.state.gameModal && (() => {
            const obj = this.state.gameModal;
            if (obj === 'loading') {
              return (
                <Modal transparent={true} onRequestClose={() => this.setState({gameModal: null})}>
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
                </Modal>
              );
            }
            const game = obj.game;
            return (
              <Modal transparent={true} onRequestClose={() => this.setState({gameModal: null})}>
                <SafeAreaView style={{flex: 1}}>
                  <StatusSpace
                    backgroundColor="rgba(0,0,0,0)"
                    leaveBar={true}
                  />
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
                </SafeAreaView>
              </Modal>
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

  render() {
    return (
      <View style={this.props.style}>
        <View style={{flexDirection: 'row'}}>
          <View style={{
            flex: 1,
            backgroundColor: 'white',
            borderRadius: 5,
            paddingTop: 3,
            paddingBottom: 3,
            paddingLeft: 7,
            paddingRight: 7,
            borderColor: 'black',
            borderWidth: 1,
          }}>
            <Text>
              {this.state.text.slice(0, this.state.chars)}
            </Text>
          </View>
          {
            this.props.onPress ? (
              <TouchableOpacity style={{margin: 10}} onPress={this.props.onPress}>
                <Image
                  style={{width: 36, height: 39}}
                  source={require('../web/assets/img/puffin.png')}
                />
              </TouchableOpacity>
            ) : (
              <Image
                style={{margin: 10, width: 36, height: 39}}
                source={require('../web/assets/img/puffin.png')}
              />
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
                        backgroundColor: 'rgb(101,88,245)',
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

export class StemportsOutpost extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  render() {
    const game = this.props.game;
    const obj = this.props.obj;
    const newVersion = obj.online && obj.offline && obj.online.version !== obj.offline.version;
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
              width: 108 * 0.25,
              height: 150 * 0.25,
              margin: 10,
            }}
          />
        </TouchableOpacity>
        <ScrollView style={{flex: 1}}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Image source={require('../web/assets/img/stemports-home-station.png')} style={{
              width: 136 * 0.4,
              height: 128 * 0.4,
              resizeMode: 'contain',
              margin: 15,
            }} />
            <Text style={{margin: 15, fontSize: 25, fontWeight: 'bold', flex: 1}}>
              {game.name}
            </Text>
          </View>
          {
            newVersion && (
              <View style={{
                padding: 15,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgb(178,174,248)',
              }}>
                <View style={{flex: 1, marginRight: 10}}>
                  <Text style={{
                    margin: 3,
                    fontWeight: 'bold',
                  }}>
                    {this.props.canSync ? "Update Available" : 'Syncing…'}
                  </Text>
                </View>
                {
                  this.props.canSync && (
                    <TouchableOpacity onPress={this.props.onSync} style={{
                      backgroundColor: 'rgb(101,88,245)',
                      padding: 10,
                      borderRadius: 4,
                    }}>
                      <Text style={{color: 'white'}}>Download Update</Text>
                    </TouchableOpacity>
                  )
                }
              </View>
            )
          }
          {
            game.description.length !== 0 && (
              <Text style={{margin: 15}}>
                {game.description}
              </Text>
            )
          }
          <Text style={{margin: 15, fontWeight: 'bold', fontSize: 17}}>
            Quests:
          </Text>
          <View style={{borderColor: 'rgb(223,230,237)', borderTopWidth: 2}}>
            <GameQuestList
              obj={obj}
              game={game}
              onSelect={this.props.onSelect}
              downloaded={obj.offline}
            />
          </View>
          {
            !(obj.offline) && (
              <View style={{alignItems: 'center', justifyContent: 'center'}}>
                <TouchableOpacity style={{
                  backgroundColor: 'rgb(101,88,245)',
                  padding: 5,
                  margin: 20,
                }} onPress={this.props.downloadingGame ? undefined : this.props.onDownload}>
                  <Text style={{color: 'white'}}>
                    {this.props.downloadingGame ? 'Downloading…' : 'Download Quests'}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          }
        </ScrollView>
      </View>
    );
  }
}
