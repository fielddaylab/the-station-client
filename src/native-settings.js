"use strict";

import React from "react";
import T from "prop-types";
import createClass from "create-react-class";
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  Linking,
  ActivityIndicator,
  StatusBar,
  BackHandler,
  Platform,
  AppState,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Dimensions
} from "react-native";
import { styles, Text } from "./styles";
import { StatusSpace } from "./status-space";
import { CacheMedia } from "./media";
import { requestImage } from "./photos";
import { withSuccess } from "./utils";
import ProgressCircle from 'react-native-progress-circle';

const NativePassword = createClass({
  displayName: "NativePassword",
  getDefaultProps: function() {
    return {
      onClose: function() {},
      onChangePassword: function() {}
    };
  },
  componentDidMount: function() {
    this.hardwareBack = () => {
      this.props.onClose();
      return true;
    };
    BackHandler.addEventListener("hardwareBackPress", this.hardwareBack);
  },
  componentWillUnmount: function() {
    BackHandler.removeEventListener("hardwareBackPress", this.hardwareBack);
  },
  render: function() {
    return (
      <View
        style={{
          flexDirection: "column",
          flex: 1,
          backgroundColor: "white"
        }}
      >
        <StatusSpace
          queueMessage={this.props.queueMessage}
        />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: "flex-start"
            }}
            onPress={this.props.onClose}
          >
            <Image
              style={{
                resizeMode: "contain",
                height: 20,
                margin: 10
              }}
              source={require("../web/assets/img/icon-back.png")}
            />
          </TouchableOpacity>
          <View
            style={{
              flex: 4,
              alignItems: "center"
            }}
          >
            <Text>Change Password</Text>
          </View>
          <View
            style={{
              flex: 1
            }}
          />
        </View>
        <ScrollView
          style={{
            flex: 1
          }}
        >
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>Current password</Text>
          </View>
          <TextInput
            placeholder="Current password"
            placeholderTextColor="rgb(180,180,180)"
            secureTextEntry={true}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={str => {
              this.oldPassword = str;
            }}
          />
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>New password</Text>
          </View>
          <TextInput
            placeholder="New password"
            placeholderTextColor="rgb(180,180,180)"
            secureTextEntry={true}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={str => {
              this.newPassword1 = str;
            }}
          />
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>
              New password, once more
            </Text>
          </View>
          <TextInput
            placeholder="New password, once more"
            placeholderTextColor="rgb(180,180,180)"
            secureTextEntry={true}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={str => {
              this.newPassword2 = str;
            }}
          />
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              if (this.newPassword1 === this.newPassword2) {
                this.props.onChangePassword(
                  {
                    username: this.props.auth.authToken.username,
                    oldPassword: this.oldPassword,
                    newPassword: this.newPassword1
                  },
                  changed => {
                    if (changed) {
                      this.props.onClose();
                    } else {
                      console.warn("could not change password");
                    }
                  }
                );
              }
            }}
          >
            <Text>Save</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
});

const NativeProfile = createClass({
  displayName: "NativeProfile",
  getDefaultProps: function() {
    return {
      onClose: function() {},
      onEditProfile: function() {}
    };
  },
  getInitialState: function() {
    return {
      display_name: this.props.auth.authToken.display_name,
      url: this.props.auth.url,
      bio: this.props.auth.bio,
      currentPicture: null,
      newPicture: null,
      progress: null
    };
  },
  componentDidMount: function() {
    this.fetchPicture();
    this.hardwareBack = () => {
      this.props.onClose();
      return true;
    };
    BackHandler.addEventListener("hardwareBackPress", this.hardwareBack);
  },
  componentWillUnmount: function() {
    BackHandler.removeEventListener("hardwareBackPress", this.hardwareBack);
  },
  fetchPicture: function() {
    var media_id;
    media_id = this.props.auth.authToken.media_id;
    if (media_id != null) {
      this.props.auth.call(
        "media.getMedia",
        {
          media_id: media_id
        },
        withSuccess(userMedia => {
          this.setState({
            currentPicture: {
              uri: userMedia.url.replace("http://", "https://")
            }
          });
        })
      );
    } else {
      this.setState({
        currentPicture: null
      });
    }
  },
  render: function() {
    return (
      <View
        style={{
          flexDirection: "column",
          flex: 1,
          backgroundColor: "white"
        }}
      >
        <StatusSpace
          queueMessage={this.props.queueMessage}
        />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              alignItems: "flex-start"
            }}
            onPress={this.props.onClose}
          >
            <Image
              style={{
                resizeMode: "contain",
                height: 20,
                margin: 10
              }}
              source={require("../web/assets/img/icon-back.png")}
            />
          </TouchableOpacity>
          <View
            style={{
              flex: 4,
              alignItems: "center"
            }}
          >
            <Text>Edit Profile</Text>
          </View>
          <View
            style={{
              flex: 1
            }}
          />
        </View>
        <ScrollView
          style={{
            flex: 1
          }}
          contentContainerStyle={{
            alignItems: "stretch"
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              paddingTop: 15
            }}
          >
            <TouchableOpacity
              onPress={() => {
                if (this.state.progress != null) {
                  return;
                }
                requestImage(false, img => {
                  if (img != null) {
                    this.setState({
                      newPicture: img
                    });
                  }
                });
              }}
            >
              {this.state.newPicture != null ? (
                <Image
                  source={this.state.newPicture}
                  style={styles.editProfilePic}
                />
              ) : this.state.currentPicture != null ? (
                <CacheMedia
                  url={this.state.currentPicture.uri}
                  online={this.props.online}
                  withURL={(url) => {
                    return (
                      <Image
                        source={url}
                        style={styles.editProfilePic}
                      />
                    );
                  }}
                />
              ) : (
                <View style={styles.editProfilePic} />
              )}
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="Username"
            placeholderTextColor="rgb(180,180,180)"
            style={styles.input}
            value={this.props.auth.authToken.username}
            editable={false}
          />
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>Display name</Text>
          </View>
          <TextInput
            placeholder="Display name"
            placeholderTextColor="rgb(180,180,180)"
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={str => {
              this.setState({
                display_name: str
              });
            }}
            value={this.state.display_name}
            editable={this.state.progress == null}
          />
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>Website</Text>
          </View>
          <TextInput
            placeholder="Website"
            placeholderTextColor="rgb(180,180,180)"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={str => {
              this.setState({
                url: str
              });
            }}
            value={this.state.url}
            editable={this.state.progress == null}
          />
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderText}>Bio</Text>
          </View>
          <TextInput
            placeholder="Bio"
            placeholderTextColor="rgb(180,180,180)"
            style={styles.input}
            autoCapitalize="sentences"
            autoCorrect={true}
            onChangeText={str => {
              this.setState({
                bio: str
              });
            }}
            value={this.state.bio}
            editable={this.state.progress == null}
          />
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              if (this.state.progress != null) {
                return;
              }
              this.props.onEditProfile(
                {
                  display_name: this.state.display_name,
                  url: this.state.url,
                  bio: this.state.bio,
                  newPicture: this.state.newPicture
                },
                progress => {
                  this.setState({ progress });
                },
                changed => {
                  if (changed) {
                    this.props.onClose();
                  } else {
                    console.warn("could not save profile");
                  }
                }
              );
            }}
          >
            <Text>
              {this.state.progress != null
                ? `Uploading photo??? ${Math.floor(this.state.progress * 100)}%`
                : "Save"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
});

export const NativeSettings = createClass({
  displayName: "NativeSettings",
  getInitialState: function() {
    return {
      setting: null
    };
  },
  getDefaultProps: function() {
    return {
      onLogout: function() {},
      onClose: function() {},
      onChangePassword: function() {},
      onEditProfile: function() {}
    };
  },
  componentDidMount: function() {
    this.hardwareBack = () => {
      this.props.onClose();
      return true;
    };
    BackHandler.addEventListener("hardwareBackPress", this.hardwareBack);
  },
  componentWillUnmount: function() {
    BackHandler.removeEventListener("hardwareBackPress", this.hardwareBack);
  },
  render: function() {
    switch (this.state.setting) {
      case "profile":
        return (
          <NativeProfile
            online={this.props.online}
            onClose={() => {
              this.setState({
                setting: null
              });
            }}
            auth={this.props.auth}
            onEditProfile={this.props.onEditProfile}
            queueMessage={this.props.queueMessage}
          />
        );
      case "password":
        return (
          <NativePassword
            onClose={() => {
              this.setState({
                setting: null
              });
            }}
            auth={this.props.auth}
            onChangePassword={this.props.onChangePassword}
            queueMessage={this.props.queueMessage}
          />
        );
      default:
        return (
          <View
            style={{
              flexDirection: "column",
              flex: 1,
              backgroundColor: "white"
            }}
          >
            <StatusSpace
              queueMessage={this.props.queueMessage}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-start",
                alignItems: "center"
              }}
            >
              <TouchableOpacity onPress={this.props.onClose}>
                <Image
                  style={{
                    resizeMode: "contain",
                    width: 69 * 0.2,
                    height: 112 * 0.2,
                    margin: 20,
                  }}
                  source={require("../web/assets/img/disclosure-arrow-left.png")}
                />
              </TouchableOpacity>
              <Text style={{
                fontSize: 32,
                fontWeight: 'bold',
                fontFamily: 'League Spartan',
              }}>
                Settings
              </Text>
            </View>
            {
              !(this.props.online) && (
                <View style={{backgroundColor: 'rgb(48,48,48)', flexDirection: 'row', alignItems: 'center'}}>
                  <View style={{flex: 1}}>
                    <Text style={{color: 'white', fontWeight: 'bold', margin: 15}}>
                      Siftr is currently in offline mode.
                    </Text>
                    {
                      (this.props.queueMessage && this.props.queueMessage.notes > 0) && (
                        <Text style={{color: 'white', margin: 15, marginTop: 0}}>
                          You have {this.props.queueMessage.notes} queued to sync when you regain connection.
                        </Text>
                      )
                    }
                  </View>
                  <Image
                    style={{
                      resizeMode: "contain",
                      width: 112 / 2,
                      height: 82 / 2,
                      margin: 25,
                      marginLeft: 0
                    }}
                    source={require("../web/assets/img/no-internet.png")}
                  />
                </View>
              )
            }
            {
              (this.props.online && this.props.queueMessage) && (
                <View style={{backgroundColor: 'rgb(90,208,173)', flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={{color: 'white', margin: 15, flex: 1}}>
                    Syncing {this.props.queueMessage.notes}
                  </Text>
                  <View style={{margin: 15}}>
                    <ProgressCircle
                      percent={this.props.queueMessage.percent}
                      radius={22}
                      borderWidth={4}
                      color="white"
                      shadowColor="rgb(90,208,173)"
                      bgColor="rgb(90,208,173)"
                      containerStyle={{
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Image
                        style={{
                          resizeMode: "contain",
                          width: 28 / 2,
                          height: 28 / 2,
                        }}
                        source={require("../web/assets/img/arrow-up.png")}
                      />
                    </ProgressCircle>
                  </View>
                </View>
              )
            }
            <ScrollView
              style={{
                flex: 1
              }}
            >
              <View style={styles.settingsHeader}>
                <Text style={styles.settingsHeaderText}>Account</Text>
              </View>
              <View style={styles.settingsSection}>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    this.setState({
                      setting: "profile"
                    });
                  }}
                >
                  <Text>Edit Profile</Text>
                  <Image
                    style={{width: 69 * 0.16, height: 112 * 0.16}}
                    source={require('../web/assets/img/disclosure-arrow-right.png')}
                  />
                </TouchableOpacity>
                <View style={styles.settingsButtonSeparator} />
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    this.setState({
                      setting: "password"
                    });
                  }}
                >
                  <Text>Change Password</Text>
                  <Image
                    style={{width: 69 * 0.16, height: 112 * 0.16}}
                    source={require('../web/assets/img/disclosure-arrow-right.png')}
                  />
                </TouchableOpacity>
                <View style={styles.settingsButtonSeparator} />
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={this.props.onLogout}
                >
                  <Text>Logout</Text>
                  <Image
                    style={{width: 69 * 0.16, height: 112 * 0.16}}
                    source={require('../web/assets/img/disclosure-arrow-right.png')}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.settingsHeader}>
                <Text style={styles.settingsHeaderText}>About</Text>
              </View>
              <View style={styles.settingsSection}>
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    Linking.openURL("https://github.com/fielddaylab/SiftrNative");
                  }}
                >
                  <Text>Open Source</Text>
                  <Image
                    style={{width: 69 * 0.16, height: 112 * 0.16}}
                    source={require('../web/assets/img/disclosure-arrow-right.png')}
                  />
                </TouchableOpacity>
                <View style={styles.settingsButtonSeparator} />
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    Linking.openURL(
                      "https://docs.google.com/document/d/16P8kIfHka-zHXoQcd9mWlUWiOkaTp6I7UcpD_GoB8LY/edit"
                    );
                  }}
                >
                  <Text>Terms of Use</Text>
                  <Image
                    style={{width: 69 * 0.16, height: 112 * 0.16}}
                    source={require('../web/assets/img/disclosure-arrow-right.png')}
                  />
                </TouchableOpacity>
                <View style={styles.settingsButtonSeparator} />
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => {
                    Linking.openURL(
                      "https://docs.google.com/document/d/1yLXB67G0NfIgp0AAsRUQYB7-LoyFsrihUydxsL_qrms/edit"
                    );
                  }}
                >
                  <Text>Privacy Policy</Text>
                  <Image
                    style={{width: 69 * 0.16, height: 112 * 0.16}}
                    source={require('../web/assets/img/disclosure-arrow-right.png')}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.settingsButtonSeparator} />
            </ScrollView>
          </View>
        );
    }
  }
});
