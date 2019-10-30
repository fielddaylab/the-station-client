"use strict";

import React from "react";
import update from "immutability-helper";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Image,
  SafeAreaView
} from "react-native";
import { styles, Text } from "./styles";
import {deserializeGame} from "./aris";
import {loadMedia, CacheMedia} from "./media";
import { StatusSpace } from "./status-space";
import { StemportsPlayer } from "./stemports-player";
import MapView, {PROVIDER_GOOGLE} from 'react-native-maps';
import {addXP, meterDistance} from './siftr-view';

const RNFS = require("react-native-fs");

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

  loadDownloadedGames() {
    this.setState({downloadedGames: [], gameModal: null}, () => {
      RNFS.readDir(`${RNFS.DocumentDirectoryPath}/siftrs`).then(items => {
        items.forEach(item => {
          RNFS.exists(`${item.path}/download_timestamp.txt`).then(exist => {
            if (exist) {
              Promise.all([
                RNFS.readFile(`${item.path}/game.txt`),
                RNFS.readFile(`${item.path}/quests.txt`),
              ]).then(([json, quests]) => {
                const game = update(
                  deserializeGame(JSON.parse(json)),
                  {quests: {$set: JSON.parse(quests)}}
                );
                this.setState(state => update(state, {downloadedGames: {$push: [game]}}));
              });
            }
          });
        });
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
    return RNFS.mkdir(siftrDir, {NSURLIsExcludedFromBackupKey: true}).then(() => {
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
        // generate quests
        let allData = {};
        objs.forEach(o => {
          [o].flat(Infinity).forEach(x => {
            if (x && x.key) {
              allData[x.key] = x.data;
            }
          });
        });
        if (allData.quests.length === 0) {
          // generate quests from remnants
          let new_quests = [];
          let new_requirement_root_packages = [];
          let new_requirement_and_packages = [];
          let new_requirement_atoms = [];
          function addTo(xs, f) {
            // make new object with sequential ID
            const new_id = 1000000 + xs.length;
            xs.push(f(new_id));
            return new_id;
          }
          allData.guides.forEach(guide => {
            const field = allData.fields.find(field => parseInt(field.field_id) === parseInt(guide.field_id));
            const selector_option = allData.fields.map(f => f.options).flat().find(opt =>
              parseInt(opt.field_guide_id) === parseInt(guide.field_guide_id)
            );
            if (!field || !selector_option) return;

            // make the compound quest
            const compound_id = addTo(new_quests, quest_id => ({
              quest_id: quest_id,
              game_id: game.game_id,
              name: field.label,
              description: '',
              prompt: '',
              stars: 0,
              quest_type: 'COMPOUND',
              parent_quest_id: 0,
              active_requirement_root_package_id: 0,
              complete_requirement_root_package_id: 0,
            }));

            // make the "get the remnants" quest
            const remnant_root_id = addTo(new_requirement_root_packages, root_id => ({
              requirement_root_package_id: root_id,
              game_id: game.game_id,
            }));
            const remnant_and_id = addTo(new_requirement_and_packages, and_id => ({
              requirement_and_package_id: and_id,
              game_id: game.game_id,
              requirement_root_package_id: remnant_root_id,
            }));
            field.options.forEach(field =>
              addTo(new_requirement_atoms, atom_id => ({
                requirement_atom_id: atom_id,
                game_id: game.game_id,
                requirement_and_package_id: remnant_and_id,
                bool_operator: 1,
                requirement: 'PLAYER_HAS_ITEM',
                content_id: field.remnant_id,
                qty: 1,
              }))
            );
            addTo(new_quests, quest_id => ({
              quest_id: quest_id,
              game_id: game.game_id,
              name: `Collect: ${field.label}`,
              description: '',
              prompt: `Find all the ${field.label} remnants!`,
              stars: 0,
              quest_type: 'QUEST',
              parent_quest_id: compound_id,
              active_requirement_root_package_id: 0,
              complete_requirement_root_package_id: remnant_root_id,
            }));

            // make the "do observations" quest
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
              requirement: 'PLAYER_HAS_NOTE_WITH_TAG',
              content_id: 10000000 + selector_option.field_option_id,
              qty: 3,
            }))
            addTo(new_quests, quest_id => ({
              quest_id: quest_id,
              game_id: game.game_id,
              name: `Observe: ${field.label}`,
              description: '',
              prompt: `Make 3 ${field.label} observations!`,
              stars: 0,
              quest_type: 'QUEST',
              parent_quest_id: compound_id,
              active_requirement_root_package_id: 0,
              complete_requirement_root_package_id: observe_root_id,
            }));
          });

          return Promise.all([
            writeJSON('quests')(allData.quests.concat(new_quests)),
            writeJSON('requirement_root_packages')(allData.requirement_root_packages.concat(new_requirement_root_packages)),
            writeJSON('requirement_and_packages')(allData.requirement_and_packages.concat(new_requirement_and_packages)),
            writeJSON('requirement_atoms')(allData.requirement_atoms.concat(new_requirement_atoms)),
          ]);
        } else {
          return; // nothing to do
        }
      }).then(() =>
        RNFS.writeFile(`${siftrDir}/download_timestamp.txt`, Date.now())
      );
    });
  }

  render() {
    if (this.state.player) {
      return (
        <StemportsPlayer
          onClose={() => this.setState({player: false})}
          onLogout={this.props.onLogout}
          auth={this.props.auth}
          onChangePassword={this.props.onChangePassword}
          onEditProfile={this.props.onEditProfile}
          queueMessage={this.props.queueMessage}
          online={this.props.online}
          onSelect={this.props.onSelect}
          inventory_zero={this.state.inventory_zero}
        />
      );
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

    if (!this.state.mapLocation) {
      const gamesByDistance = gameList.slice(0);
      gamesByDistance.sort((a, b) => a.distance - b.distance);
      return (
        <View style={{flex: 1}}>
          <Text style={{margin: 10, fontSize: 25}}>
            Get to a Science Station
          </Text>
          <Text style={{margin: 10}}>
            {
              gamesByDistance.length > 0 && gamesByDistance[0].distance < 1000
              ? `It looks like you're at the ${gamesByDistance[0].game.name} Science Station. Download Quests to get started!`
              : 'You need to be at a science station to start a quest. Here are the closest ones.'
            }
          </Text>
          <ScrollView style={{flex: 1}}>
            {
              gamesByDistance.map(o =>
                <View key={o.game.game_id} style={{margin: 10, flexDirection: 'row'}}>
                  <TouchableOpacity style={{flex: 1}} onPress={() => {
                    this.setState({mapLocation: o.game, gameModal: o});
                  }}>
                    <Text style={{fontWeight: 'bold', margin: 5}}>
                      {o.game.name}
                    </Text>
                    <Text style={{fontStyle: 'italic', margin: 5}}>
                      {(o.distance / 1000).toFixed(2)} km away
                    </Text>
                  </TouchableOpacity>
                  <View>
                    <TouchableOpacity onPress={() => {
                      this.setState({mapLocation: o.game});
                    }} style={{
                      backgroundColor: 'rgb(101,88,245)',
                      padding: 5,
                    }}>
                      <Text style={{color: 'white'}}>Map it</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            }
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={{flex: 1}}>
        <MapView
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: this.state.mapLocation.latitude,
            longitude: this.state.mapLocation.longitude,
            latitudeDelta: 1,
            longitudeDelta: 1,
          }}
          style={{
            flex: 1,
          }}
          showsUserLocation={true}
          mapType="standard"
        >
          {
            // separate markers drawn first for the text labels
            gameList.map(obj => {
              const game = obj.game;
              return (
                <MapView.Marker
                  key={'text' + game.game_id}
                  tracksViewChanges={false}
                  coordinate={{
                    latitude: game.latitude,
                    longitude: game.longitude,
                  }}
                  anchor={{x: 0.5, y: 0.5}}
                >
                  <MapView.Callout tooltip={true} />
                  <View style={{
                    alignItems: 'center',
                  }}>
                    <Text style={{opacity: 0}}>
                      {game.name}
                    </Text>
                    <View
                      style={{
                        opacity: 0,
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        borderWidth: 2,
                      }}
                    />
                    <Text>
                      {game.name}
                    </Text>
                  </View>
                </MapView.Marker>
              );
            })
          }
          {
            gameList.map(obj => {
              const game = obj.game;
              return (
                <MapView.Marker
                  key={game.game_id}
                  tracksViewChanges={false}
                  coordinate={{
                    latitude: game.latitude,
                    longitude: game.longitude,
                  }}
                  anchor={{x: 0.5, y: 0.5}}
                  onPress={() => this.setState({gameModal: obj})}
                >
                  <MapView.Callout tooltip={true} />
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      backgroundColor: 'rgb(40,80,120)',
                      borderRadius: 13,
                      borderWidth: 2,
                      borderColor: 'white',
                    }}
                  />
                </MapView.Marker>
              );
            })
          }
        </MapView>
        <TouchableOpacity onPress={() =>
          this.setState({mapLocation: null})
        } style={{
          position: 'absolute',
          padding: 8,
          backgroundColor: 'white',
          borderColor: 'black',
          borderWidth: 1,
          borderRadius: 5,
          left: 10,
          bottom: 10,
        }}>
          <Text>back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() =>
          this.setState({player: true})
        } style={{
          position: 'absolute',
          padding: 8,
          backgroundColor: 'white',
          borderColor: 'black',
          borderWidth: 1,
          borderRadius: 5,
          right: 10,
          bottom: 10,
        }}>
          <Text>player</Text>
        </TouchableOpacity>
        {
          this.state.gameModal && (() => {
            const obj = this.state.gameModal;
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
                    onUpload={() => this.uploadGame(game).then(() => this.loadDownloadedGames())}
                    onDownload={() => this.initializeGame(game, obj.offline).then(() => this.loadDownloadedGames())}
                    onClose={() => this.setState({gameModal: null})}
                    onSelect={this.props.onSelect}
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

export class StemportsOutpost extends React.Component {
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
        <View style={{alignItems: 'center', padding: 10}}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <CacheMedia
              media_id={game.icon_media_id}
              auth={this.props.auth}
              online={true}
              withURL={(url) =>
                <View style={{margin: 10, alignItems: 'stretch', alignSelf: 'stretch'}}>
                  <Image
                    source={url}
                    style={{
                      width: 90,
                      height: 90,
                      resizeMode: 'contain',
                    }}
                  />
                </View>
              }
            />
            <View style={{margin: 10, flex: 1}}>
              <Text style={{fontSize: 25}}>{game.name}</Text>
            </View>
          </View>
          <View style={{margin: 10}}>
            <Text>{game.description}</Text>
          </View>
        </View>
        {
          obj.offline ? (
            <View style={{flex: 1}}>
              <View style={{
                padding: 10,
                alignItems: 'center',
              }}>
                <Text style={{textDecorationLine: 'underline'}}>All Quests</Text>
              </View>
              <ScrollView style={{flex: 1, borderColor: 'black', borderWidth: 1}}>
                {
                  (obj.offline ? obj.offline.quests : obj.online.quests).filter(quest =>
                    !parseInt(quest.parent_quest_id)
                  ).map(quest =>
                    <View key={quest.quest_id} style={{flexDirection: 'row'}}>
                      <Text style={{flex: 1, margin: 5}}>{quest.name}</Text>
                      <TouchableOpacity onPress={() =>
                        obj.offline && this.props.onSelect(game, quest)
                      } style={{
                        backgroundColor: 'rgb(101,88,245)',
                        padding: 5,
                        margin: 5,
                      }}>
                        <Text style={{color: 'white'}}>start</Text>
                      </TouchableOpacity>
                    </View>
                  )
                }
              </ScrollView>
            </View>
          ) : (
            <View style={{alignItems: 'center', justifyContent: 'center', flex: 1}}>
              <Text style={{fontSize: 25, margin: 5, textAlign: 'center'}}>
                Download Quests
              </Text>
              <Text style={{margin: 5, textAlign: 'center'}}>
                It looks like you're at the {game.name} Science Station.
                Download Quests to get started!
              </Text>
              <TouchableOpacity style={{
                backgroundColor: 'rgb(101,88,245)',
                padding: 5,
                margin: 5,
              }} onPress={this.props.onDownload}>
                <Text style={{color: 'white'}}>
                  Download Quests
                </Text>
              </TouchableOpacity>
            </View>
          )
        }
        <View style={{alignItems: 'center', padding: 10}}>
          {
            obj.offline && (
              <TouchableOpacity onPress={this.props.onUpload} style={{
                width: 200,
                padding: 10,
                borderColor: 'black',
                borderWidth: 1,
                backgroundColor: 'white',
              }}>
                <Text>Upload</Text>
              </TouchableOpacity>
            )
          }
          {
            obj.online && (
              <TouchableOpacity onPress={this.props.onDownload} style={{
                width: 200,
                padding: 10,
                borderColor: 'black',
                borderWidth: 1,
                backgroundColor: 'white',
              }}>
                <Text>{newVersion ? "Download (update!)" : "Download"}</Text>
              </TouchableOpacity>
            )
          }
          <TouchableOpacity onPress={this.props.onClose} style={{
            width: 200,
            padding: 10,
            borderColor: 'black',
            borderWidth: 1,
            backgroundColor: 'white',
          }}>
            <Text>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
