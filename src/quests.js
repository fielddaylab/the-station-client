'use strict';

import React from 'react';
import {
  View
, ScrollView
, TouchableOpacity
, Image
} from 'react-native';
import {Text} from './styles';
import {CacheMedia} from './media';
import {GuideLine} from './stemports-picker';

export const getQuestProgress = (details) => {
  let progress = [];
  details && details.reqRoots.forEach(root => {
    // this is all hacked for now, to match how generated quests look
    if (!root.ands) return;
    const and = root.ands[0];

    // get field notes
    const fieldNoteAtoms = and.atoms.filter(atom => atom.atom.requirement === 'PLAYER_HAS_ITEM');
    if (fieldNoteAtoms.length > 0) {
      progress.push({
        subquestLabel: 'Explore and Collect Field Notes',
        done: fieldNoteAtoms.filter(o => o.bool).length,
        halfDone: fieldNoteAtoms.filter(o => o.bool === null).length,
        total: fieldNoteAtoms.length,
        root: root,
        keyIndex: 1,
      });
    }

    // go to tour stops
    const tourStopAtoms = and.atoms.filter(atom => atom.atom.requirement === 'PLAYER_VIEWED_PLAQUE');
    if (tourStopAtoms.length > 0) {
      progress.push({
        subquestLabel: 'Visit Tour Stops',
        done: tourStopAtoms.filter(o => o.bool).length,
        halfDone: 0,
        total: tourStopAtoms.length,
        root: root,
        keyIndex: 2,
      });
    }

    // make observations
    const observationAtoms = and.atoms.filter(atom => atom.atom.requirement === 'PLAYER_HAS_NOTE_WITH_QUEST');
    if (observationAtoms.length > 0) {
      const total = observationAtoms.map(o => o.atom.qty).reduce((a, b) => a + b, 0)
      progress.push({
        subquestLabel: `Make ${total} Observations`,
        done: observationAtoms.map(o => o.qty).reduce((a, b) => a + b, 0),
        halfDone: 0,
        total: total,
        root: root,
        keyIndex: 3,
      });
    }
  });
  return progress;
};

export const QuestDotDetails = function(props) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: 'rgb(67,139,176)',
      flexDirection: 'column',
      paddingLeft: 10,
      paddingRight: 10,
    }}>
      <View style={{height: 80}} />
      <View style={{
        backgroundColor: 'white',
        flex: 1,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        paddingTop: 10,
      }}>
        <ScrollView style={{flex: 1, padding: 5}}>
          <Text style={{flex: 1, margin: 10, fontSize: 20, fontWeight: 'bold'}}>Quest Progress:</Text>
          <Text style={{flex: 1, margin: 10, fontSize: 20}}>{props.currentQuest.name}</Text>
          <View style={{
            padding: 5,
            borderColor: 'gray',
            borderTopWidth: 1,
          }} />
          {
            (() => {
              if (!props.quests) return;
              if (!props.currentQuest) return;
              const details = props.quests &&
                props.quests.displayInfo &&
                props.quests.displayInfo.find(o =>
                  parseInt(o.quest.quest_id) === parseInt(props.currentQuest.quest_id)
                );
              const progress = getQuestProgress(details);
              return progress.map((o, i) => {
                const {subquestLabel, done, halfDone, total, root, keyIndex} = o;
                let circles = [];
                for (let i = 0; i < total; i++) {
                  let halves = 0;
                  if (i < done + halfDone) halves++;
                  if (i < done) halves++;
                  circles.push(halves);
                }
                return (
                  <View key={root.req.requirement_root_package_id * 10 + keyIndex} style={{
                    padding: 5,
                    marginLeft: 10,
                    marginRight: 10,
                  }}>
                    <Text style={{margin: 5}}>
                      {subquestLabel}
                    </Text>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                      {circles.map((halves, i) =>
                        halves === 1 ? (
                          <Image
                            key={i}
                            source={require('../web/assets/img/stemports-dot-half.png')}
                            style={{
                              borderColor: 'black',
                              borderWidth: 2,
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              margin: 3,
                              resizeMode: 'contain',
                            }}
                          />
                        ) : (
                          <View
                            key={i}
                            style={{
                              backgroundColor: halves >= 2 ? 'rgb(178,172,250)' : 'white',
                              borderColor: 'black',
                              borderWidth: 2,
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              margin: 3,
                            }}
                          />
                        )
                      )}
                    </View>
                  </View>
                );
              });
            })()
          }
        </ScrollView>
        <View style={{
          margin: 15,
          alignItems: 'center',
        }}>
          <TouchableOpacity onPress={props.onClose}>
            <Image
              style={{
                width: 140 * 0.45,
                height: 140 * 0.45,
              }}
              source={require("../web/assets/img/quest-close.png")}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}>
        <Image
          style={{width: 197 * 0.5, height: 145 * 0.5}}
          source={require('../web/assets/img/stemports-puffin-color.png')}
        />
      </View>
    </View>
  );
}

export const QuestDetails = function(props) {
  const media_id = props.quest[props.status + '_media_id'];
  return (
    <View style={{
      flex: 1,
      backgroundColor: 'rgb(67,139,176)',
      flexDirection: 'column',
      paddingLeft: 10,
      paddingRight: 10,
    }}>
      <View style={{height: 80}} />
      <View style={{
        backgroundColor: '#aea',
        flex: 1,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        paddingTop: 10,
      }}>
        <ScrollView style={{flex: 1}}>
          {
            props.message && (
              <View style={{
                margin: 15,
              }}>
                <Text>{ props.message }</Text>
              </View>
            )
          }
          {
            media_id && (
              <CacheMedia
                media_id={media_id}
                auth={props.auth}
                online={true}
                withURL={(url) => (
                  <View>
                    <Image
                      source={url}
                      style={{
                        height: 200,
                        resizeMode: 'contain',
                      }}
                    />
                  </View>
                )}
              />
            )
          }
          <View style={{
            margin: 15,
          }}>
            <Text style={{fontWeight: 'bold'}}>{ props.quest.name }</Text>
          </View>
          <View style={{
            margin: 15,
          }}>
            <Text>{ props.quest[props.status + '_description'] }</Text>
          </View>
          {
            (props.quest.sub_active || []).map(sub =>
              <View key={sub.quest_id} style={{margin: 15}}>
                <Text>[ ] {sub.name}</Text>
              </View>
            )
          }
          {
            (props.quest.sub_complete || []).map(sub =>
              <View key={sub.quest_id} style={{margin: 15}}>
                <Text>[x] {sub.name}</Text>
              </View>
            )
          }
        </ScrollView>
        <View style={{
          margin: 15,
          alignItems: 'center',
        }}>
          <TouchableOpacity onPress={props.onClose}>
            <Image
              style={{
                width: 140 * 0.45,
                height: 140 * 0.45,
              }}
              source={require("../web/assets/img/quest-close.png")}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}>
        <Image
          style={{width: 197 * 0.5, height: 145 * 0.5}}
          source={require('../web/assets/img/stemports-puffin-color.png')}
        />
      </View>
    </View>
  );
}

const QuestEntry = function(props) {
  return (
    <TouchableOpacity onPress={props.onPress} style={{
      padding: 15,
      borderColor: '#092E50',
      borderTopWidth: 1,
      borderBottomWidth: 1,
    }}>
      <Text style={{fontWeight: 'bold'}}>{props.quest.name}</Text>
      <Text>{props.quest[props.status + '_description']}</Text>
    </TouchableOpacity>
  );
};

export const TaskComplete = (props) => {
  return (
    <View style={{
      flex: 1,
      backgroundColor: 'white',
    }}>
      <GuideLine
        style={{padding: 5}}
        text="Oh snap you did it!"
      />
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{fontSize: 30}}>Task Complete!</Text>
      </View>
      <View style={{
        padding: 30,
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={props.onClose} style={{
          backgroundColor: 'rgb(98,97,241)',
          padding: 10,
          borderRadius: 4,
        }}>
          <Text style={{color: 'white'}}>Start next task</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const GenericModal = (props) => {
  return (
    <View style={{
      flex: 1,
      backgroundColor: 'rgb(67,139,176)',
      flexDirection: 'column',
      paddingLeft: 10,
      paddingRight: 10,
    }}>
      <View style={{height: 80}} />
      <View style={{
        backgroundColor: '#aea',
        flex: 1,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        paddingTop: 10,
      }}>
        <ScrollView style={{flex: 1}}>
          {props.children}
        </ScrollView>
        <View style={{
          margin: 15,
          alignItems: 'center',
        }}>
          <TouchableOpacity onPress={props.onClose}>
            <Image
              style={{
                width: 140 * 0.45,
                height: 140 * 0.45,
              }}
              source={require("../web/assets/img/quest-close.png")}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{
        position: 'absolute',
        top: 10,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}>
        <Image
          style={{width: 197 * 0.5, height: 145 * 0.5}}
          source={require('../web/assets/img/stemports-puffin-color.png')}
        />
      </View>
    </View>
  );
}

export class QuestsScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      viewingQuest: null,
      tab: 'active',
    };
  }

  render() {
    if (this.state.viewingQuest) {
      return (
        <QuestDetails
          quest={this.state.viewingQuest.quest}
          status={this.state.viewingQuest.status}
          onClose={() => this.setState({viewingQuest: null})}
          auth={this.props.auth}
        />
      );
    }
    return (
      <View style={{
        flex: 1,
        backgroundColor: 'rgb(67,139,176)',
        flexDirection: 'column',
        paddingLeft: 10,
        paddingRight: 10,
      }}>
        <View style={{height: 80}} />
        <View style={{
          backgroundColor: '#aea',
          flex: 1,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          paddingTop: 10,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingBottom: 10,
          }}>
            <TouchableOpacity style={{
              borderBottomWidth: 4,
              borderBottomColor: this.state.tab === 'active' ? '#5DE3D4' : 'rgba(0,0,0,0)',
              padding: 5,
            }} onPress={() => this.setState({tab: 'active'})}>
              <Text>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{
              borderBottomWidth: 4,
              borderBottomColor: this.state.tab === 'complete' ? '#5DE3D4' : 'rgba(0,0,0,0)',
              padding: 5,
            }} onPress={() => this.setState({tab: 'complete'})}>
              <Text>Complete</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{flex: 1}}>
            {
              this.props.quests && (
                this.props.quests[this.state.tab].map((quest) =>
                  <QuestEntry
                    key={quest.quest_id}
                    quest={quest}
                    onPress={() => this.setState({viewingQuest: {quest: quest, status: this.state.tab}})}
                    status={this.state.tab}
                  />
                )
              )
            }
          </ScrollView>
          <View style={{
            margin: 15,
            alignItems: 'center',
          }}>
            <TouchableOpacity onPress={this.props.onClose}>
              <Image
                style={{
                  width: 140 * 0.45,
                  height: 140 * 0.45,
                }}
                source={require("../web/assets/img/quest-close.png")}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{
          position: 'absolute',
          top: 10,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}>
          <Image
            style={{width: 197 * 0.5, height: 145 * 0.5}}
            source={require('../web/assets/img/stemports-puffin-color.png')}
          />
        </View>
      </View>
    );
  }
}
