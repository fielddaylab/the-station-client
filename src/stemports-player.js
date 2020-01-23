"use strict";

import React from "react";
import update from "immutability-helper";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  SafeAreaView
} from "react-native";
import { styles, Text } from "./styles";
import {loadMedia, CacheMedia} from "./media";
import { StatusSpace } from "./status-space";
import { NativeSettings } from "./native-settings";
import { deserializeGame } from "./aris";

const RNFS = require("react-native-fs");

export class StemportsPlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      settings: false,
      games: [],
    };
  }

  componentDidMount() {
    this.loadGames();
  }

  loadGames() {
    this.setState({games: []}, () => {
      RNFS.readDir(`${RNFS.DocumentDirectoryPath}/siftrs`).then(items => {
        items.forEach(item => {
          RNFS.exists(`${item.path}/download_timestamp.txt`).then(exist => {
            if (exist) {
              Promise.all([
                RNFS.readFile(`${item.path}/game.txt`),
                RNFS.readFile(`${item.path}/fields.txt`),
                RNFS.readFile(`${item.path}/guides.txt`),
                RNFS.readFile(`${item.path}/inventory.txt`),
                RNFS.readFile(`${item.path}/quests-sorted.txt`).catch(() => null),
              ]).then(([json, fields, guides, inventory, quests]) => {
                const game = update(
                  deserializeGame(JSON.parse(json)),
                  {
                    fields: {$set: JSON.parse(fields)},
                    guides: {$set: JSON.parse(guides)},
                    inventory: {$set: JSON.parse(inventory)},
                    quests: {$set: quests && JSON.parse(quests)},
                  }
                );
                this.setState(state => update(state, {games: {$push: [game]}}));
              });
            }
          });
        });
      });
    });
  }

  getCompleteGuides() {
    let guides = [];
    this.state.games.forEach(game => {
      game.guides.forEach(guide => {
        const field = game.fields.find(field => parseInt(field.field_id) === parseInt(guide.field_id));
        if (!field) return;
        const complete = field.options.every(option =>
          !parseInt(option.remnant_id) || game.inventory.find(inst =>
            inst.object_type === 'ITEM'
            && inst.owner_type === 'USER'
            && parseInt(inst.object_id) === parseInt(option.remnant_id)
            && parseInt(inst.qty) > 0
          )
        );
        if (complete) {
          guides.push({game: game, guide: guide, field: field});
        }
      });
    });
    return guides;
  }

  getCompleteQuests() {
    let quests = [];
    this.state.games.forEach(game => {
      game.quests && game.quests.complete.forEach(quest => {
        quests.push({game: game, quest: quest});
      });
    });
    return quests;
  }

  currentLevel() {
    const cutoffs = [0, 10, 50, 100, 250, 500, 1000];
    const instance = (this.props.inventory_zero || []).find(inst =>
      inst.object_type === 'ITEM' && parseInt(inst.object_id) === 35
    );
    const xp = instance ? parseInt(instance.qty) : 0;
    const level = cutoffs.filter(cutoff => xp >= cutoff).length;
    return {
      level: level,
      xp: xp,
      this_cutoff: cutoffs[level - 1],
      next_cutoff: cutoffs[level],
    };
  }

  render() {
    if (this.state.settings) {
      return (
        <NativeSettings
          onClose={() => this.setState({settings: false})}
          onLogout={this.props.onLogout}
          auth={this.props.auth}
          onChangePassword={this.props.onChangePassword}
          onEditProfile={this.props.onEditProfile}
          queueMessage={this.props.queueMessage}
          online={this.props.online}
        />
      );
    }

    const xpStuff = this.currentLevel();

    return (
      <View style={{flex: 1}}>
        <ScrollView style={{flex: 1}}>
          <View style={{alignItems: 'flex-end'}}>
            <TouchableOpacity onPress={() => this.setState({settings: true})}>
              <Image
                style={{
                  width: 44 * 1,
                  height: 44 * 1,
                  margin: 15,
                }}
                source={require("../web/assets/img/icon-gear.png")}
              />
            </TouchableOpacity>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'}}>
            <CacheMedia
              media_id={this.props.auth.authToken.media_id}
              auth={this.props.auth}
              online={this.props.online}
              withURL={url =>
                <Image source={url} style={{
                  height: 100,
                  width: 100,
                  resizeMode: 'contain',
                }} />
              }
            />
            <Text style={{
              fontWeight: 'bold',
              fontSize: 20,
            }}>
              {this.props.auth.authToken.display_name || this.props.auth.authToken.username}
            </Text>
          </View>
          <View style={{
            padding: 25,
            borderBottomWidth: 2,
            borderColor: 'rgb(223,230,237)',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
              <Text style={{padding: 5, fontSize: 17}}>
                Level {xpStuff.level}
              </Text>
              <Text style={{padding: 5, fontSize: 17}}>
                {xpStuff.xp - xpStuff.this_cutoff} / {xpStuff.next_cutoff - xpStuff.this_cutoff}
              </Text>
            </View>
            <View style={{
              height: 14,
              flexDirection: 'row',
              alignItems: 'stretch',
              alignSelf: 'stretch',
              margin: 6,
            }}>
              <View style={{
                flex: xpStuff.xp - xpStuff.this_cutoff,
                backgroundColor: 'rgb(75,92,107)',
              }} />
              <View style={{
                flex: xpStuff.next_cutoff - xpStuff.xp,
                backgroundColor: 'rgb(216,222,227)',
              }} />
            </View>
          </View>
          <View style={{
            padding: 25,
            borderBottomWidth: 2,
            borderColor: 'rgb(223,230,237)',
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <View style={{flex: 1, marginRight: 10}}>
              <Text style={{
                fontSize: 17,
                margin: 3,
              }}>
                Observation Queue
              </Text>
              <Text style={{
                margin: 3,
              }}>
                {this.props.syncMessage}
              </Text>
            </View>
            {
              this.props.canSync && (
                <TouchableOpacity onPress={this.props.onSync} style={{
                  backgroundColor: 'rgb(101,88,245)',
                  padding: 10,
                  borderRadius: 4,
                }}>
                  <Text style={{color: 'white'}}>sync</Text>
                </TouchableOpacity>
              )
            }
          </View>
          <View style={{padding: 13}}>
            <Text style={{fontSize: 17, padding: 12}}>Complete Field Guides</Text>
            {
              this.getCompleteGuides().map(o =>
                <TouchableOpacity key={o.guide.field_guide_id} onPress={() => this.props.onSelect(o.game)}>
                  <Text style={{padding: 12, fontWeight: 'bold'}}>
                    {o.field.label} ({o.game.name})
                  </Text>
                  <Text style={{padding: 12, paddingLeft: 20}}>
                    {o.field.options.map(opt => opt.option).join(', ')}
                  </Text>
                </TouchableOpacity>
              )
            }
            <Text style={{fontSize: 17, padding: 12}}>Complete Quests</Text>
            {
              this.getCompleteQuests().map(o =>
                <TouchableOpacity key={o.quest.quest_id} onPress={() => this.props.onSelect(o.game)}>
                  <Text style={{padding: 12, fontWeight: 'bold'}}>
                    {o.quest.name} ({o.game.name})
                  </Text>
                </TouchableOpacity>
              )
            }
          </View>
        </ScrollView>
        <View style={{
          alignItems: 'center',
        }}>
          <TouchableOpacity onPress={this.props.onClose}>
            <Image
              style={{
                width: 140 * 0.45,
                height: 140 * 0.45,
                margin: 5,
              }}
              source={require("../web/assets/img/quest-close.png")}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
