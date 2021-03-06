'use strict';

import React from 'react';
import {
  View
, TouchableOpacity
, ScrollView
, Image
, Animated
, PanResponder
, Modal
, TouchableWithoutFeedback
, ImageBackground
, SafeAreaView
} from 'react-native';
import {CacheMedia, CacheMedias} from './media';
import {WebView} from 'react-native-webview';
import ModelView from '../react-native-3d-model-view/lib/ModelView';
import update from "immutability-helper";
import {SiftrThumbnails} from './thumbnails';
import {SquareImage, GalleryModal} from './note-view';
import {Text, FixedMarkdown, hypher} from './styles';
import { globalstyles } from "./global-styles";
import {GuideLine} from './stemports-picker';

export const PuffinSnacksID = 141587;
export const PhotoItemIDs = [214742, 214743, 214744, 214745, 214746, 214747, 214748, 214749, 214750, 214751];
export const PhotoImages = [
  require('../web/assets/img/cache-photo-00.jpg'),
  require('../web/assets/img/cache-photo-01.jpg'),
  require('../web/assets/img/cache-photo-02.jpg'),
  require('../web/assets/img/cache-photo-03.jpg'),
  require('../web/assets/img/cache-photo-04.jpg'),
  require('../web/assets/img/cache-photo-05.jpg'),
  require('../web/assets/img/cache-photo-06.jpg'),
  require('../web/assets/img/cache-photo-07.jpg'),
  require('../web/assets/img/cache-photo-08.jpg'),
  require('../web/assets/img/cache-photo-09.jpg'),
];
import analytics from '@react-native-firebase/analytics';

export class FullWidthWebView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <View
        style={this.props.style}
        onLayout={event => {
          this.setState({webViewWidth: event.nativeEvent.layout.width});
        }}
      >
        <WebView
          style={{
            flex: 1,
            width: this.state.webViewWidth,
          }}
          source={this.props.source}
          originWhitelist={this.props.originWhitelist}
          useWebKit={true}
        />
      </View>
    );
  }
}

export function webViewBoilerplate(str) {
  return `
    <html>
    <head>
      <style type='text/css'>
      html { margin:0; padding:0; }
      body {
          color:#000000;
          font-size:20px;
          font-family:HelveticaNeue-Light;
          margin:0;
          padding:10;
          zoom:2.0;
      }
      a { color: #000000; text-decoration: underline; }
      </style>
    </head>
    <body>${str}</body>
    </html>
  `;
}

export class CacheContents extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      screen: this.props.mode === 'tour-stop' ? 'open' : 'closed',
      // screen goes: 'closed', 'open', 'note', 'photo' (optional), 'snacks'
      eventIndex: 0,
    };
  }

  componentDidMount() {
    analytics().logEvent('ViewCache',{
      station_name: this.props.game.name,
      quest_name: this.props.currentQuest.name,
      cache_name: this.props.item == null ? "(cache inside tour stop)" : this.props.item.name,
    })
  }

  toNoteNextStep() {
    if (this.props.mode === 'tour-stop' && this.state.eventIndex < this.props.events.length - 1) {
      this.setState({screen: 'open', eventIndex: this.state.eventIndex + 1});
      return;
    }

    this.props.selectPhoto().then((photo_id) => {
      if (photo_id) {
        this.setState({screen: 'photo', photo_id: photo_id});
      } else {
        this.props.selectSnack().then((shouldGiveSnacks) => {
          if (shouldGiveSnacks) {
            this.setState({screen: 'snacks'});
          } else {
            this.setState({screen: 'closing'});
          }
        });
      }
    });
  }

  render() {
    let currentItem = this.props.item;
    let currentTriggerEvent = this.props.trigger;
    if (this.props.mode === 'tour-stop') {
      const event = this.props.events[this.state.eventIndex];
      currentItem = this.props.items.find(item => parseInt(item.item_id) === parseInt(event.content_id));
      currentTriggerEvent = event;
    }

    switch (this.state.screen) {
      case 'closed':
        return (
          <ImageBackground source={require('../web/assets/img/cache-closed-bg.jpg')} style={globalstyles.backgroundImage}>
            <View style={{
              flex: 1,
              flexDirection: 'column',
              backgroundColor: 'rgba(0,0,0,0.1)',
              alignItems: 'center',
              justifyContent: 'space-around',
            }}>
              <Text style={{
                color: 'white',
                fontSize: 25,
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}>
                Cache found!
              </Text>
              <Image
                source={require('../web/assets/img/cache-chest-closed.png')}
                style={{
                  margin: 20,
                  alignSelf: 'stretch',
                  resizeMode: 'contain',
                  width: null,
                  height: 250,
                }}
              />
              <TouchableOpacity onPress={() => this.setState({screen: 'open'})} style={{
                backgroundColor: 'white',
                padding: 8,
                borderRadius: 5,
                marginBottom: 50,
              }}>
                <Text style={{
                  color: '#647033',
                  fontWeight: 'bold',
                  fontSize: 20,
                  textTransform: 'uppercase',
                }}>
                  Open
                </Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        );
      case 'open':
      case 'note':
        return (
          <ImageBackground source={require('../web/assets/img/cache-open-bg.jpg')} style={globalstyles.backgroundImage}>
            <View style={{
              flex: 1,
              flexDirection: 'column',
              backgroundColor: 'rgba(0,0,0,0.1)',
              alignItems: 'center',
              justifyContent: 'space-evenly',
            }}>
              <Text style={{
                color: 'white',
                fontSize: 30,
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}>
                New field note!
              </Text>
              <TouchableOpacity onPress={() => this.setState({screen: 'note'})}>
                <ImageBackground source={require('../web/assets/img/cache-field-note-card.png')} style={{
                  alignItems: 'center',
                  borderRadius: 5,
                  margin: 5,
                  shadowColor: '#5D0D0D',
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  shadowOffset: {height: 2},
                  width: 476 * 0.5,
                  height: 644 * 0.5,
                  paddingTop: 40,
                }}>
                  <CacheMedia
                    media_id={parseInt(currentItem.icon_media_id) || parseInt(currentItem.media_id)}
                    auth={this.props.auth}
                    online={true}
                    withURL={(url) => (
                      <Image
                        source={url}
                        style={{
                          height: 150,
                          width: 150,
                          resizeMode: 'contain',
                        }}
                      />
                    )}
                  />
                  <Text style={{
                    margin: 10,
                    textAlign: 'center',
                    width: 100,
                  }}>
                    {currentItem.name}
                  </Text>
                </ImageBackground>
              </TouchableOpacity>
              {
                this.state.screen === 'note' && (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    onRequestClose={this.toNoteNextStep.bind(this)}
                  >
                    <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
                      <ItemScreen
                        animationType="slide"
                        type="trigger"
                        trigger={currentTriggerEvent}
                        item={currentItem}
                        auth={this.props.auth}
                        onClose={this.toNoteNextStep.bind(this)}
                        onPickUp={(triggerEvent) => {
                          this.props.addChip('Added to field guide!', 'rgb(219,179,52)', 'field-guide');
                          this.props.onPickUp(triggerEvent);
                        }}
                      />
                    </SafeAreaView>
                  </Modal>
                )
              }
            </View>
          </ImageBackground>
        );
      case 'photo':
        return (
          <ImageBackground source={require('../web/assets/img/cache-open-bg.jpg')} style={globalstyles.backgroundImage}>
            <View style={{
              flex: 1,
              flexDirection: 'column',
              backgroundColor: 'rgba(0,0,0,0.1)',
              alignItems: 'center',
              justifyContent: 'space-around',
            }}>
              <TouchableOpacity onPress={() => {
                this.props.givePhoto(this.state.photo_id);
                this.props.addChip('Added to photo album!', 'rgb(110,186,180)', 'photos');
                this.props.selectSnack().then((shouldGiveSnacks) => {
                  if (shouldGiveSnacks) {
                    this.setState({screen: 'snacks'});
                  } else {
                    this.props.onClose();
                  }
                });
              }} style={{
                backgroundColor: 'white',
                padding: 8,
                borderRadius: 5,
              }}>
                <Image
                  source={PhotoImages[PhotoItemIDs.indexOf(this.state.photo_id)]}
                  style={{
                    margin: 20,
                    resizeMode: 'contain',
                    width: 250,
                    height: 450,
                  }}
                />
              </TouchableOpacity>
            </View>
          </ImageBackground>
        );
      case 'snacks':
        return (
          <ImageBackground source={require('../web/assets/img/cache-open-bg.jpg')} style={globalstyles.backgroundImage}>
            <View style={{
              flex: 1,
              flexDirection: 'column',
              backgroundColor: 'rgba(0,0,0,0.1)',
              alignItems: 'center',
              justifyContent: 'space-evenly',
            }}>
              <Text style={{
                color: 'white',
                fontSize: 25,
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}>
                Puffin snacks!
              </Text>
              <Image
                source={require('../web/assets/img/puffin-snacks.png')}
                style={{
                  width: 220,
                  height: 220,
                  resizeMode: 'contain',
                }}
              />
              <TouchableOpacity onPress={() => {
                this.props.giveSnack();
                this.props.addChip('Collected puffin snacks!', 'rgb(238,107,100)', 'snacks');
                this.props.onClose();
              }} style={{
                backgroundColor: 'white',
                padding: 8,
                borderRadius: 5,
                shadowColor: '#5D0D0D',
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: {height: 2},
                marginBottom: 40,
              }}>
                <Text style={{
                  color: '#647033',
                  fontSize: 20,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}>
                  Collect
                </Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        );
      case 'closing':
        // this is ugly, it's because if you unmount a modal inside another modal, the whole app softlocks!
        // this would otherwise happen when we don't have photo or snacks to give
        setTimeout(this.props.onClose, 500);
        return null;
    }
  }
}

export class ItemScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <ImageBackground source={require('../web/assets/img/paper-texture.jpg')} style={[globalstyles.backgroundImage, {
        flex: 1,
        flexDirection: 'column',
        marginTop: 20,
        marginLeft: 20,
        marginRight: 20,
        borderRadius: 20,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: 'hidden',
        backgroundColor: 'white',
      }]}>
        <View style={{
          flex: 1,
        }}>
          <View style={{flexDirection: 'row', alignItems: 'stretch'}}>
            <CacheMedias
              medias={[this.props.item.media_id, this.props.item.media_id_2, this.props.item.media_id_3].filter(x => parseInt(x)).map(media_id =>
                ({media_id: media_id, auth: this.props.auth, online: true})
              )}
              withURLs={(urls) => {
                const url = urls[0];
                if (url && url.uri && url.uri.match(/\.zip$/)) {
                  return (
                    <View style={{marginTop: 20, marginBottom: 20, flexDirection: 'column', alignItems: 'center'}}>
                      <ModelView
                        source={{ zip: url }}
                        style={{
                          width: 200,
                          height: 150,
                        }}
                        autoPlay={true}
                      />
                    </View>
                  );
                } else if (url && url.uri) {
                  return <React.Fragment>
                    <SquareImage
                      sources={urls}
                      margin={urls.length > 1 ? 10 : 0}
                      peek={urls.length > 1 ? 20 : 0}
                      onGallery={({uri}) => this.setState({gallery: uri})}
                    />
                    {
                      this.state.gallery != null && (
                        <GalleryModal
                          onClose={() => this.setState({gallery: null})}
                          initialPage={urls.map(x => x.uri).indexOf(this.state.gallery)}
                          images={urls.map((url) => ({source: url}))}
                        />
                      )
                    }
                  </React.Fragment>;
                } else {
                  return null;
                }
              }}
            />
          </View>
          <Text style={{
            marginLeft: 10,
            marginTop: 15,
            fontSize: 24,
            fontWeight: 'bold',
          }}>
            {this.props.item.name}
          </Text>
          <ScrollView style={{flex: 1, alignSelf: 'stretch', margin: 10}}>
            <FixedMarkdown text={this.props.item.description.replace(/\n/g, (m) => (m + m))} />
          </ScrollView>
          {
            this.props.type === 'trigger' ? (
              <View style={{alignItems: 'center'}}>
                <TouchableOpacity onPress={() => {
                  this.props.onPickUp(this.props.trigger);
                  this.props.onClose();
                }} style={{
                  backgroundColor: 'white',
                  padding: 8,
                  borderRadius: 5,
                  shadowColor: '#5D0D0D',
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  shadowOffset: {height: 2},
                  marginBottom: 20,
                }}>
                <Text style={{
                  color: '#647033',
                  fontSize: 20,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}>
                  Add to Field Notes
                </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={globalstyles.closeContainer} pointerEvents="box-none">
                <TouchableOpacity onPress={this.props.onClose}>
                  <Image
                    style={globalstyles.closeButton}
                    source={require("../web/assets/img/quest-close.png")}
                  />
                </TouchableOpacity>
              </View>
            )
          }
        </View>
      </ImageBackground>
    );
  }
};

export function groupBy(n, xs) {
  let ys = [];
  while (true) {
    if (xs.length === 0) break;
    if (xs.length <= n) {
      ys.push(xs);
      break;
    }
    ys.push(xs.slice(0, n));
    xs = xs.slice(n);
  }
  return ys;
}

export class InventoryScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      viewing: null,
      niceModal: false,
      observations: this.props.guideTab === 'observations',
    };
    this._itemSlots = {};
  }

  render() {
    if (this.state.viewing) {
      return (
        <ItemScreen
          type="inventory"
          item={this.state.viewing.item}
          auth={this.props.auth}
          onClose={() => this.setState({viewing: null})}
        />
      );
    }

    const itemInstances = this.props.inventory.filter(inst =>
      inst.object_type === 'ITEM'
      && inst.owner_type === 'USER'
      && parseInt(inst.qty) > 0
    );

    const tags = (this.props.tags || []).filter(tag =>
      parseInt(tag.quest_id) === parseInt(this.props.quest_id)
    ).map(tag => {
      let taggedItems = [];
      (this.props.object_tags || []).forEach(object_tag => {
        if (object_tag.object_type !== 'ITEM') return;
        if (parseInt(object_tag.tag_id) === parseInt(tag.tag_id)) {
          const item = (this.props.items || []).find(x => parseInt(x.item_id) === parseInt(object_tag.object_id));
          if (!item) return;
          taggedItems.push({
            item: item,
            instance: itemInstances.find(inst => parseInt(inst.object_id) === parseInt(item.item_id)),
          });
        }
      });
      return {tag: tag, items: taggedItems};
    }).sort((a, b) => {
      const a_empty = !a.items.some(item => item.instance);
      const b_empty = !b.items.some(item => item.instance);
      if (true /* a_empty === b_empty */) {
        const a_tag = parseInt(a.tag.sort_index);
        const b_tag = parseInt(b.tag.sort_index);
        if (a_tag === b_tag) {
          return parseInt(a.tag.tag_id) - parseInt(b.tag.tag_id);
        } else {
          return a_tag - b_tag;
        }
      }
      if (a_empty) return 1;
      if (b_empty) return -1;
    });

    const untaggedInstances = itemInstances.filter(inst =>
      !(tags.some(tag => tag.items.some(item => item.instance === inst)))
    );

    const filteredPickups = this.props.pickedUpRemnants.filter(item_id =>
      tags.some(tag => tag.items.some(item => parseInt(item.item.item_id) === parseInt(item_id)))
    );

    let guideMessage = '';
    if (this.state.observations) {
      guideMessage = "Here are all the observations you've made.";
    } else if (tags.every(o => o.items.every(o => o.instance))) {
      guideMessage = "Congratulations, you've completed these field notes!";
    } else if (filteredPickups.length !== 0) {
      guideMessage = "You've found some field notes. Now, place them in the right areas of your guide!";
    } else {
      guideMessage = "Go find more field notes to fill in the empty spaces in your guide!";
    }

    const makeTabs = () => (
      <View style={{flexDirection: 'row'}}>
        <TouchableOpacity onPress={() => {
          this.props.setGuideTab('notes')
          this.setState({observations: false});
        }} style={{
          flex: 1,
          padding: 15,
          alignItems: 'center',
        }}>
          <Text style={{ fontFamily: 'LeagueSpartan-Bold', fontSize: 16, color: (this.state.observations ? '#939393' : '#444444'),}}>Field Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          this.props.setGuideTab('observations')
          this.setState({observations: true});
        }} style={{
          flex: 1,
          padding: 15,
          alignItems: 'center',
        }}>
          <Text style={{ fontFamily: 'LeagueSpartan-Bold', fontSize: 16, color: (this.state.observations ? '#444444' : '#939393'),}}> My Observations</Text>
        </TouchableOpacity>
      </View>
    );

    if (this.state.observations) {
      return (
        <View style={{
          backgroundColor: '#ffffff',
          flex: 1,
          alignItems: 'stretch',
        }}>
          <GuideLine
            style={{
              padding: 10,
            }}
            text={guideMessage}
            auth={this.props.auth}
          />
          {makeTabs()}
          <View style={{flex: 1}}>
            <SiftrThumbnails
              hasMore={false}
              pendingNotes={this.props.pendingNotes}
              notes={this.props.notes.filter(note =>
                parseInt(note.user.user_id) === parseInt(this.props.auth.authToken.user_id)
              )}
              game={this.props.game}
              auth={this.props.auth}
              online={this.props.online}
              onSelectNote={this.props.onSelectNote}
              getColor={this.props.getColor}
            />
          </View>
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

    return (
      <View style={{
        backgroundColor: '#ffffff',
        flex: 1,
      }}>
        <GuideLine
          style={{
            padding: 10,
          }}
          text={guideMessage}
          auth={this.props.auth}
        />
        {makeTabs()}
        <ImageBackground source={require('../web/assets/img/paper-texture.jpg')} style={globalstyles.backgroundImage} imageStyle={{opacity:0.8}}>
        <ScrollView style={{flex: 1,}}>
          {
            false /* disabling for now */ && untaggedInstances.map(inst => {
              const item = (this.props.items || []).find(x => parseInt(x.item_id) === parseInt(inst.object_id));
              return (
                <TouchableOpacity key={inst.instance_id} onPress={() =>
                  this.setState({viewing: {item: item, instance: inst}})
                }>
                  <Text style={{
                    margin: 20,
                    textAlign: 'center',
                  }}>
                    {inst.qty} x {item ? item.name : '???'}
                  </Text>
                </TouchableOpacity>
              );
            })
          }
          {
            tags.map(o => {
              const tag = o.tag;
              const items = o.items;
              return (
                <View key={tag.tag_id} ref={slot => this._itemSlots[tag.tag_id] = slot} style={{
                  borderColor: '#EAD9D9',
                  borderTopWidth: 2,
                  paddingBottom: 15,
                }}>
                  <Text style={{
                    margin: 20,
                    fontWeight: 'bold',
                    fontSize: 16,
                    color: '#713F29',
                  }}>
                    {tag.tag}
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                  }}>
                    {
                      items.map(o => {
                        const isPlaced = o.instance;
                        if (isPlaced) {
                          return (
                            <TouchableOpacity key={o.item.item_id} onPress={() =>
                              isPlaced && this.setState({viewing: {item: o.item, instance: o.instance}})
                            }>
                              <ImageBackground source={require('../web/assets/img/note-filled.png')} style={{
                                alignItems: 'center',
                                borderRadius: 5,
                                margin: 5,
                                shadowColor: '#5D0D0D',
                                shadowOpacity: 0.1,
                                shadowRadius: 12,
                                shadowOffset: {height: 2},
                                width: 200 * 0.5,
                                height: 280 * 0.5,
                              }}>
                                <CacheMedia
                                  media_id={parseInt(o.item.icon_media_id) || parseInt(o.item.media_id)}
                                  auth={this.props.auth}
                                  online={true}
                                  withURL={(url) => (
                                    <Image
                                      source={url}
                                      style={{
                                        height: 65,
                                        width: 65,
                                        margin: 10,
                                        marginBottom: 0,
                                        resizeMode: 'contain',
                                      }}
                                    />
                                  )}
                                />
                                <Text
                                  numberOfLines={2}
                                  style={{
                                    margin: 10,
                                    textAlign: 'center',
                                    width: 100,
                                  }}
                                >
                                  {hypher.hyphenateText(o.item.name)}
                                </Text>
                              </ImageBackground>
                            </TouchableOpacity>
                          );
                        } else {
                          return (
                            <Image key={o.item.item_id} source={require('../web/assets/img/note-space.png')} style={{
                              width: 200 * 0.5,
                              height: 280 * 0.5,
                              margin: 5,
                            }} />
                          );
                        }
                      })
                    }

                  </View>
                </View>
              );
            }).filter(x => x)
          }
        </ScrollView>
        </ImageBackground>
        <View style={{
          height: 140,
          alignItems: 'stretch',
          shadowColor: '#5D0D0D',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: {height: 2},
        }}>
          <ScrollView scrollEnabled={!this.state.dragging} disableScrollViewPanResponder={true} horizontal={true} style={{flex: 1, overflow: 'visible'}}>
            {
              filteredPickups.map(item_id => {
                const item = (this.props.items || []).find(x => parseInt(x.item_id) === parseInt(item_id));
                if (!item) return null;
                const object_tag = (this.props.object_tags || []).find(otag =>
                  otag.object_type === 'ITEM' && parseInt(otag.object_id) === parseInt(item.item_id)
                );
                if (!object_tag) return null;
                const tag_id = object_tag.tag_id;
                return (
                  <DraggableItem
                    key={item_id}
                    auth={this.props.auth}
                    item={item}
                    onStartDrag={() => {
                      this.setState({dragging: true});
                    }}
                    onRelease={(obj, cb) => {
                      this.setState({dragging: false});
                      if (Math.abs(obj.gestureState.dx) < 10 && Math.abs(obj.gestureState.dy) < 10) {
                        this.setState({viewing: {item: item, instance: null}});
                      }
                      if (this._itemSlots[tag_id]) {
                        this._itemSlots[tag_id].measure((ox, oy, width, height, px, py) => {
                          const inBounds =
                            px <= obj.moveX && obj.moveX <= px + width &&
                            py <= obj.moveY && obj.moveY <= py + height;
                          if (inBounds) {
                            this.props.onPlace(item_id);
                            this.setState({niceModal: true});
                          }
                          cb(inBounds);
                        });
                      } else {
                        cb(false); // probably shouldn't happen
                      }
                    }}
                  />
                );
              })
            }
          </ScrollView>
        </View>
        <View style={globalstyles.closeContainer} pointerEvents="box-none">
          <TouchableOpacity onPress={this.props.onClose}>
            <Image
              style={globalstyles.closeModifier}
              source={require("../web/assets/img/quest-close.png")}
            />
          </TouchableOpacity>
        </View>
        {
          this.state.niceModal && (
            <Modal transparent={true} onRequestClose={() => this.setState({niceModal: false})}>
              <TouchableWithoutFeedback onPress={() => this.setState({niceModal: false})}>
                  <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <ImageBackground
                      source={require('../web/assets/img/card-bg.png')}
                      style={{
                        padding: 10,
                        alignItems: 'center',
                      }}
                      imageStyle={{
                        resizeMode: 'contain',
                      }}
                      >
                      <Image source={require('../web/assets/img/icon-nice-check.png')} style={{
                        margin: 10,
                        width: 180 * 0.5,
                        height: 182 * 0.5,
                      }} />
                      <Text style={{
                        margin: 10,
                        fontSize: 18,
                        fontWeight: 'bold',
                        fontFamily: 'League Spartan',
                        color: 'rgb(254,251,225)',
                      }}>
                        Nice!
                      </Text>
                      </ImageBackground>
                  </View>
              </TouchableWithoutFeedback>
            </Modal>
          )
        }
      </View>
    );
  }
}

export class DraggableItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    };
    this._val = {x: 0, y: 0}
    this._pan = new Animated.ValueXY();
    this._pan.addListener(value => this._val = value);
    this._pan.setValue({x: 0, y: 0});
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => {
        this.props.onStartDrag();
        return true;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,
      onPanResponderMove: (evt, gestureState) => {
        this._lastMoveX = gestureState.moveX;
        this._lastMoveY = gestureState.moveY;
        Animated.event([
          null, { dx: this._pan.x, dy: this._pan.y }
        ])(evt, gestureState);
      },
      onPanResponderTerminationRequest: (evt, gestureState) => true,
      onPanResponderRelease: (evt, gestureState) => {
        this.props.onRelease({moveX: this._lastMoveX, moveY: this._lastMoveY, gestureState: gestureState}, (inBounds) => {
          if (!inBounds) {
            Animated.spring(this._pan, {
              toValue: { x: 0, y: 0 },
              friction: 5
            }).start();
          }
        });
      },
    });
  }

  render() {
    return (
      <Animated.View
        {...this._panResponder.panHandlers}
        style={{
          transform: this._pan.getTranslateTransform(),
          margin: 13,
          marginTop: 20,
          backgroundColor: 'white',
          borderRadius: 4,
        }}
      >
        <CacheMedia
          media_id={parseInt(this.props.item.icon_media_id) || parseInt(this.props.item.media_id)}
          auth={this.props.auth}
          online={true}
          withURL={(url) => (
            <Image
              source={url}
              style={{
                flex: 1,
                margin: 5,
                resizeMode: 'contain',
                minWidth: 60,
              }}
            />
          )}
        />
        <Text style={{
          margin: 5,
          textAlign: 'center',
        }}>
          {this.props.item.name}
        </Text>
      </Animated.View>
    );
  }
}
