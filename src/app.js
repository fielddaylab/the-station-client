// Generated by CoffeeScript 2.3.0
"use strict";
var ref1;

import React from "react";
import createClass from "create-react-class";

import {
  Linking,
  BackHandler,
  AppState,
  SafeAreaView,
  // YellowBox,
  Alert,
  Text
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { UploadQueue, deleteQueuedNotes } from "./upload-queue";
import { Terms } from "./native-terms";
import RNFS from "react-native-fs";
import analytics from '@react-native-firebase/analytics';
import Permissions from "react-native-permissions";
import { NativeLogin } from "./native-login";
import { Loading } from "./native-home";
import Orientation from 'react-native-orientation-locker';
import Geolocation from '@react-native-community/geolocation';
import { StemportsPicker } from './stemports-picker';
import { StemportsWizard } from './stemports-wizard';

import { Auth, Game, displayError } from "./aris";
import { SiftrViewPW, downloadGame } from "./siftr-view";

import { withSuccess } from "./utils";

import { parseUri } from "./parse-uri";

// YellowBox.ignoreAllLogs();//Ignore all log notifications

const recentlyOpened = `${RNFS.DocumentDirectoryPath}/recent.json`;
const seenComic = `${RNFS.DocumentDirectoryPath}/seencomic.txt`;
const seenWizard = `${RNFS.DocumentDirectoryPath}/seenwizard.txt`;

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;

export var SiftrNative = createClass({
  displayName: "SiftrNative",

  getInitialState: function() {
    return {
      auth: null,
      games: null,
      followed: null,
      game: null,
      menuOpen: false,
      online: true,
      screen: null,
      recent: null,
      inSplash: true,
      inTutorial: false,
      seenWizardForQuestIDs: [],
    };
  },

  getDefaultProps: function() {
    return {
      viola: false
    };
  },


  componentDidMount: function() {
    RNFS.readFile(seenComic, 'utf8').then(() => {
      // this.setState({inTutorial: true});
      // do nothing
    }).catch((err) => {
      this.setState({inTutorial: true});
    })
    RNFS.readFile(seenWizard, 'utf8').then((s) => {
      const res = JSON.parse(s);
      if (Array.isArray(res)) {
        this.setState({seenWizardForQuestIDs: res});
      }
    }).catch((err) => {
      // do nothing
    })
    RNFS.readFile(recentlyOpened, 'utf8').then((str) => {
      this.setState({recent: JSON.parse(str)});
    }).catch((err) => {
      // file probably doesn't exist, no problem
      this.setState({recent: []});
    });
    Linking.getInitialURL().then(url => {
      this.parseURL(url);
      this.urlHandler = ({ url }) => {
        this.parseURL(url);
      };
      Linking.addEventListener("url", this.urlHandler);
    });
    this.withInfo = connectionInfo => {
      var online, ref1;
      online = (ref1 = connectionInfo.type) !== "none" && ref1 !== "NONE";
      this.setState({ online }, () => {
        if (online) {
          this.login();
        } else if (this.state.auth == null) {
          new Auth().loadSavedAuth(authToken => {
            this.setState({
              auth: Object.assign(new Auth(), { authToken })
            }, () => {
              this.updateFollowed();
            });
          });
        }
      });
    };
    NetInfo.fetch().then(this.withInfo);
    this.removeNetInfo = NetInfo.addEventListener(this.withInfo);
    this.withAppState = appState => {
      if (appState !== "active") {
        this.setState({
          aris: false
        });
      }
    };
    AppState.addEventListener("change", this.withAppState);
    if (this.props.viola) {
      this.hardwareBack = () => {
        this.props.backToViola();
        return true;
      };
      BackHandler.addEventListener(
        "hardwareBackPress",
        this.hardwareBack
      );
    }
    Permissions.request('location').then(response => {
      if (response === 'authorized') {
        this.watchID = Geolocation.watchPosition((loc) => {


          if (!true)
          Alert.alert(
            "DEBUG",
            loc,
            `Lat:${Number.parseFloat(loc.coords.latitude).toFixed(5)} 
Long:${Number.parseFloat(loc.coords.longitude).toFixed(5)}`,
            [
              {
                text: "Cancel",
                onPress: () => console.log("Cancel Pressed"),
                style: "cancel"
              },
              { text: "OK", onPress: () => console.log("OK Pressed") }
            ]
          )

          this.setState({location: loc});
        }, (err) => {
          // do nothing; we need to pass this to avoid
          // https://github.com/facebook/react-native/issues/9490#issuecomment-271974881
        }, {
          timeout: 1000,
          enableHighAccuracy: true,
          maximumAge: 1000,
          distanceFilter: 10,
          useSignificantChanges: false,
        });
      }
    });
    Orientation.lockToPortrait();
  },
  componentWillUnmount: function() {
    this.removeNetInfo && this.removeNetInfo();
    Linking.remove("url", this.urlHandler);
    AppState.remove("change", this.withAppState);
    if (this.hardwareBack != null) {
      BackHandler.removeEventListener(
        "hardwareBackPress",
        this.hardwareBack
      );
    }
    if (this.watchID) {
      navigator.geolocation.clearWatch(this.watchID);
    }
    Orientation.unlockAllOrientations();
  },
  parseURL: function(url) {
    var auth,
      i,
      k,
      kv,
      len,
      mapping,
      parsed,
      ref1,
      ref2,
      siftr_id,
      siftr_url,
      v;
    if (!url) {
      this.setState({
        aris: false
      });
      return;
    }
    mapping = {};
    parsed = parseUri(url);
    if (parsed.protocol === "siftr") {
      ref1 = parsed.query.split("&");
      for (i = 0, len = ref1.length; i < len; i++) {
        kv = ref1[i];
        [k, v] = kv.split("=");
        mapping[k] = v;
      }
      siftr_id = parseInt(mapping.siftr_id);
      if (siftr_id) {
        this.launchByID({
          aris: parseInt(mapping.aris) ? true : false,
          siftr_id: siftr_id,
          nomen_id: parseInt(mapping.nomen_id),
          species_id: decodeURIComponent(
            (mapping.species_id + "").replace(/\+/g, "%20")
          )
        });
      }
    } else if (parsed.host === "siftr.org") {
      siftr_id = 0;
      siftr_url = parsed.query;
      if (siftr_url.length === 0 || siftr_url.match(/aris=1/)) {
        siftr_url = parsed.path.replace(/\//g, "");
      }
      if (!siftr_url.match(/[^0-9]/)) {
        siftr_id = parseInt(siftr_url);
        siftr_url = null;
      }
      auth = (ref2 = this.state.auth) != null ? ref2 : new Auth();
      if (siftr_url != null) {
        auth.searchSiftrs(
          {
            siftr_url: siftr_url
          },
          withSuccess(games => {
            if (games.length === 1) {
              this.setState({
                game: games[0]
              });
            }
          })
        );
      } else if (siftr_id) {
        auth.getGame(
          {
            game_id: siftr_id
          },
          withSuccess(game => {
            if (game != null) {
              this.setState({
                game: games[0]
              });
            }
          })
        );
      }
    }
  },
  launchByID: function({ aris, siftr_id, nomen_id, species_id, saved_note }) {
    var ref1, ref2;
    if (
      ((ref1 = this.state.game) != null ? ref1.game_id : undefined) === siftr_id
    ) {
      return;
    }
    ((ref2 = this.state.auth) != null ? ref2 : new Auth()).getGame(
      {
        game_id: siftr_id
      },
      withSuccess(game => {
        this.setState({
          game: game,
          aris: aris,
          saved_note: saved_note,
          nomenData: nomen_id ? { nomen_id, species_id } : undefined
        });
      })
    );
  },
  clearNomenData: function() {
    this.setState({
      nomenData: null,
      saved_note: null
    });
  },
  componentDidUpdate: function() {
    if ( this.state.game != null
      && this.state.recent != null
      && this.state.recent[0] !== this.state.game.game_id
    ) {
      const newRecent = [this.state.game.game_id].concat(
        this.state.recent.filter((x) => x !== this.state.game.game_id)
      );
      this.setState({recent: newRecent}, () => {
        RNFS.writeFile(recentlyOpened, JSON.stringify(newRecent), 'utf8');
      });
    }
  },
  updateGames: function() {
    this.state.auth.getGamesForUser(
      {order: 'recent'},
      withSuccess(games => {
        this.setState({
          games: games.filter((game) => game.is_siftr)
        });
      })
    );
  },
  updateFollowed: function() {
    const storeFollowed = `${RNFS.DocumentDirectoryPath}/siftrs/followed.txt`;
    if (this.state.online) {
      const thisUpdate = this.lastUpdate = Date.now();
      const oldSiftrs = this.state.followed || [];
      this.state.auth.getFollowedGamesForUser(
        {order: 'recent'},
        withSuccess(games => {
          if (this.lastUpdate !== thisUpdate) return;
          const siftrs = games.filter((game) => game.is_siftr);
          RNFS.writeFile(
            `${RNFS.DocumentDirectoryPath}/siftrs/followed.txt`,
            JSON.stringify(siftrs)
          );
          this.setState({followed: siftrs});
          siftrs.forEach((game) => {
            if (!oldSiftrs.some((oldGame) => oldGame.game_id === game.game_id)) {
              downloadGame(this.state.auth, game);
            }
          });
        })
      );
    } else {
      RNFS.readFile(storeFollowed, 'utf8').then((str) => {
        const siftrs = JSON.parse(str).map(game => Object.assign(new Game(), game));
        this.setState({followed: siftrs});
      });
    }
  },
  followGame: function(game, cb) {
    this.state.auth.call(
      "games.followGame",
      {
        game_id: game.game_id
      },
      withSuccess(() => {
        if (cb) cb();
        this.updateFollowed();
      })
    );
  },
  unfollowGame: function(game, cb) {
    this.state.auth.call(
      "games.unfollowGame",
      {
        game_id: game.game_id
      },
      withSuccess(() => {
        if (cb) cb();
        this.updateFollowed();
      })
    );
  },
  loadGamePosition: function(game, {create, quest}) {
    this.setState({
      game,
      quest,
      createOnLaunch: create,
      bounds: null
    });
  },
  login: function(username, password) {
    var ref2;
    if (!this.state.online) {
      displayError({
        error: "Couldn't connect to Siftr."
      });
      return;
    }
    ((ref2 = this.state.auth) != null ? ref2 : new Auth()).login(
      username,
      password,
      (newAuth, err) => {
        var nomen_id, saved_note, siftr_id, siftr_url, species_id;
        if (username != null && password != null && newAuth.authToken == null) {
          displayError(err);
        }
        this.setState({
          auth: newAuth,
          games: null,
          followed: null
        });
        if (newAuth.authToken != null) {
          analytics().logEvent("login", {
            username: newAuth.authToken.username,
            user_id: newAuth.authToken.user_id
          });
          if (this.state.online) {
            this.updateGames();
            this.updateFollowed();
            if (this.props.viola) {
              ({
                nomen_id,
                species_id,
                saved_note
              } = this.props.getViolaInfo());
              this.launchByID({
                siftr_id: this.props.siftr_id,
                nomen_id: nomen_id,
                species_id: species_id,
                saved_note: saved_note
              });
            }
          }
          this.setState({
            menuOpen: false
          });
        }
      }
    );
  },
  showTerms: function(username, password, email) {
    this.registerInfo = { username, password, email };
    this.setState({
      showingTerms: true
    });
  },
  registerNow: function(username, password, email) {
    this.registerInfo = { username, password, email };
    this.register();
  },
  register: function() {
    var email, password, ref2, username;
    if (!this.state.online) {
      displayError({
        error: "Couldn't connect to Siftr.",
        errorMore:
          "You need to be connected to the internet to create an account."
      });
      return;
    }
    ({ username, password, email } = this.registerInfo);
    ((ref2 = this.state.auth) != null ? ref2 : new Auth()).register(
      username,
      password,
      email,
      (newAuth, err) => {
        if (newAuth.authToken == null) {
          displayError(err);
        }
        this.setState({
          showingTerms: false,
          auth: newAuth,
          games: null,
          followed: null
        });
        if (newAuth.authToken != null) {
          if (this.state.online) {
            this.updateGames();
            this.updateFollowed();
          }
          this.setState({
            menuOpen: false
          });
        }
      }
    );
  },
  logout: function() {
    var ref2;
    ((ref2 = this.state.auth) != null ? ref2 : new Auth()).logout(
      newAuth => {
        this.setState({
          auth: newAuth,
          menuOpen: false
        });
      }
    );
  },
  gameBelongsToUser: function(game) {
    var ref2;
    return (ref2 = this.state.games) != null
      ? ref2.some(userGame => {
          return userGame.game_id === game.game_id;
        })
      : undefined;
  },
  changePassword: function(args, cb) {
    var ref2;
    if (this.state.online) {
      ((ref2 = this.state.auth) != null
        ? ref2
        : new Auth()
      ).changePassword(args, (newAuth, err) => {
        if (newAuth.authToken) {
          this.setState({
            auth: newAuth
          });
          cb(true);
        } else {
          cb(false);
        }
      });
    } else {
      cb(false);
    }
  },
  editProfile: function(args, progress, cb) {
    var ref2;
    if (this.state.online) {
      ((ref2 = this.state.auth) != null ? ref2 : new Auth()).editProfile(
        args,
        progress,
        (newAuth, err) => {
          if (newAuth.authToken) {
            this.setState({
              auth: newAuth
            });
            cb(true);
          } else {
            cb(false);
          }
        }
      );
    } else {
      cb(false);
    }
  },

  modifySeenWizardQuestIDs: function(modifier) {
    const newSeen = modifier(this.state.seenWizardForQuestIDs);
    this.setState({seenWizardForQuestIDs: newSeen});
    RNFS.writeFile(seenWizard, JSON.stringify(newSeen), 'utf8');
  },

  exitGame: function(clearGameID, clearQuestID) {
    let o = {game: null};
    if (clearGameID) {
      this.modifySeenWizardQuestIDs(ids =>
        // TODO this should probably actually remove all quests for this station
        ids.filter(id => parseInt(id) !== parseInt(clearQuestID))
      );
      if (this.state.pendingNotes) {
        const game_id = parseInt(clearGameID);
        const thisStationNotes = this.state.pendingNotes.filter(({dir, json}) =>
          parseInt(JSON.parse(json).game_id) === game_id
        );
        const otherNotes = this.state.pendingNotes.filter(({dir, json}) =>
          parseInt(JSON.parse(json).game_id) !== game_id
        );
        o.pendingNotes = otherNotes;
        deleteQueuedNotes(thisStationNotes);
      }
    }
    this.setState(o);
  },

  replayIntro: function() {
    this.state.auth.call('client.logPlayerResetGame', {
      game_id: 100058,
    }, () => {
      this.state.auth.call('notes.deleteUserNotesForGame', {
        user_id: this.state.auth.authToken.user_id,
        game_id: 100058,
      }, (res2) => {
        const siftrDir = `${RNFS.DocumentDirectoryPath}/siftrs/100058`;
        RNFS.unlink(siftrDir).catch(() => null).then(() =>
          RNFS.unlink(`${RNFS.DocumentDirectoryPath}/seenwizard.txt`).catch(() => null)
        ).then(() =>
          RNFS.unlink(`${RNFS.DocumentDirectoryPath}/siftrs/current-quest.txt`).catch(() => null)
        ).then(() => {
          this.setState({inTutorial: true});
          this.exitGame(100058, 62027);
        });
      });
    });
  },

  render: function() {
    if (this.state.auth != null) {
      return (
        <UploadQueue
          auth={this.state.auth}
          online={this.state.online}
          withPendingNotes={pendingNotes => {
            this.setState({ pendingNotes });
          }}
        >
          {this.state.auth.authToken != null ? (
            this.state.game != null ? (
              this.state.seenWizardForQuestIDs.indexOf(parseInt(this.state.quest.quest_id)) === -1 ? (
                <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
                  <StemportsWizard
                    game={this.state.game}
                    quest={this.state.quest}
                    onClose={() => {
                      this.modifySeenWizardQuestIDs(ids =>
                        ids.concat([parseInt(this.state.quest.quest_id)])
                      );
                    }}
                  />
                </SafeAreaView>
              ) : (
                <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
                  <SiftrViewPW
                    game={this.state.game}
                    currentQuest={this.state.quest}
                    bounds={this.state.bounds}
                    auth={this.state.auth}
                    isAdmin={this.gameBelongsToUser(this.state.game)}
                    aris={this.state.aris}
                    location={this.state.location}
                    onExit={(clearData = false) => {
                      if (clearData) {
                        this.exitGame(this.state.game.game_id, this.state.quest.quest_id);
                      } else {
                        this.exitGame();
                      }
                    }}
                    onExitQuest={(reopenStation) => {
                      this.setState({
                        game: null,
                        reopenStation: reopenStation ? this.state.game : undefined,
                        didFinish: true,
                      });
                    }}
                    onPromptLogin={() => {
                      this.setState({
                        menuOpen: true
                      });
                    }}
                    nomenData={this.state.nomenData}
                    clearNomenData={this.clearNomenData}
                    createOnLaunch={this.state.createOnLaunch}
                    clearCreate={() => this.setState({createOnLaunch: false})}
                    online={this.state.online}
                    followed={this.state.followed}
                    followGame={this.followGame}
                    unfollowGame={this.unfollowGame}
                    queueMessage={this.state.queueMessage}
                    viola={this.props.viola}
                    onViolaIdentify={this.props.onViolaIdentify}
                    onLogout={this.logout}
                    onChangePassword={this.changePassword}
                    onEditProfile={this.editProfile}
                    saved_note={this.state.saved_note}
                    pendingNotes={this.state.pendingNotes}
                    ref={ref => {
                      this.siftrView = ref;
                    }}
                    onSelect={(game, quest) =>
                      this.setState({
                        game: null,
                        aris: false
                      }, () => {
                        this.loadGamePosition(game, {quest: quest});
                      })
                    }
                    onReplayIntro={this.replayIntro}
                  />
                </SafeAreaView>
              )
            ) : (
              <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
                <StemportsPicker
                  auth={this.state.auth}
                  onLogout={this.logout}
                  onSelect={(game, quest) => {
                    this.setState({inTutorial: false});
                    RNFS.writeFile(seenComic, 'true', 'utf8');
                    this.loadGamePosition(game, {quest: quest})
                  }}
                  online={this.state.online}
                  onChangePassword={this.changePassword}
                  onEditProfile={this.editProfile}
                  queueMessage={this.state.queueMessage}
                  location={this.state.location}
                  launchCurrentQuest={!this.state.didFinish}
                  inSplash={this.state.inSplash}
                  viewComic={this.state.inTutorial}
                  onCloseSplash={() => {
                    this.setState({inSplash: false});
                  }}
                  onSkipTutorial={() => {
                    this.setState({inSplash: false, inTutorial: false});
                    RNFS.writeFile(seenComic, 'true', 'utf8');
                  }}
                  currentStation={this.state.reopenStation}
                  onReplayIntro={this.replayIntro}
                />
              </SafeAreaView>
            )
          ) : this.state.showingTerms ? (
            <Terms
              onAccept={() => {
                this.register();
              }}
              onCancel={() => {
                this.setState({
                  showingTerms: false
                });
              }}
            />
          ) : (
            <NativeLogin
              onLogin={this.login}
              onRegister={this.showTerms}
              viola={this.props.viola}
              backToViola={this.props.backToViola}
              online={this.state.online}
            />
          )}
        </UploadQueue>
      );
    } else {
      return <Loading queueMessage={this.state.queueMessage} />;
    }
  },


});