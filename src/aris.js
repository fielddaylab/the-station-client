"use strict";

import { Alert } from "react-native";
import AsyncStorage from '@react-native-community/async-storage';
import update from "immutability-helper";
import { uploadImage } from "./photos";

const ARIS_URL = "https://fieldday-web.wcer.wisc.edu/stemports/server/";

export const Game = class Game {
  constructor(json) {
    if (json != null) {
      this.game_id = parseInt(json.game_id);
      this.name = json.name;
      this.description = json.description;
      this.latitude = parseFloat(json.map_latitude);
      this.longitude = parseFloat(json.map_longitude);
      this.zoom = parseInt(json.map_zoom_level);
      this.siftr_url = json.siftr_url || null;
      this.is_siftr = parseInt(json.is_siftr) ? true : false;
      this.published = parseInt(json.published) ? true : false;
      this.moderated = parseInt(json.moderated) ? true : false;
      this.colors_id = parseInt(json.colors_id) || null;
      this.theme_id = parseInt(json.theme_id) || null;
      this.icon_media_id = parseInt(json.icon_media_id);
      this.created = new Date(json.created.replace(" ", "T") + "Z");
      this.prompt = json.prompt;
      this.password = json.password;
      this.type = json.type;
      this.map_show_labels = parseInt(json.map_show_labels) ? true : false;
      this.map_show_roads = parseInt(json.map_show_roads) ? true : false;
      this.map_type = json.map_type;
      this.field_id_preview = parseInt(json.field_id_preview) || null;
      this.field_id_pin = parseInt(json.field_id_pin) || null;
      this.field_id_caption = parseInt(json.field_id_caption) || null;
      this.force_new_format = parseInt(json.force_new_format) ? true : false;
      this.version = parseInt(json.version);
      this.quests = json.quests; // present in getAllStemportsStations
    } else {
      this.game_id = null;
      this.name = null;
      this.description = null;
      this.latitude = null;
      this.longitude = null;
      this.zoom = null;
      this.siftr_url = null;
      this.is_siftr = null;
      this.published = null;
      this.moderated = null;
      this.colors_id = null;
      this.theme_id = null;
      this.icon_media_id = null;
      this.created = null;
      this.prompt = null;
      this.password = null;
      this.type = null;
      this.map_show_labels = null;
      this.map_show_roads = null;
      this.map_type = null;
      this.field_id_preview = null;
      this.field_id_pin = null;
      this.field_id_caption = null;
      this.force_new_format = null;
      this.version = null;
    }
  }

  createJSON() {
    return {
      game_id: this.game_id || undefined,
      name: this.name || "",
      description: this.description || "",
      map_latitude: this.latitude || 0,
      map_longitude: this.longitude || 0,
      map_zoom_level: this.zoom || 0,
      siftr_url: this.siftr_url,
      is_siftr: this.is_siftr,
      published: this.published,
      moderated: this.moderated,
      colors_id: this.colors_id,
      theme_id: this.theme_id,
      icon_media_id: this.icon_media_id,
      prompt: this.prompt,
      password: this.password,
      type: this.type,
      map_show_labels: this.map_show_labels,
      map_show_roads: this.map_show_roads,
      map_type: this.map_type,
      field_id_preview: this.field_id_preview,
      field_id_pin: this.field_id_pin,
      field_id_caption: this.field_id_caption,
    };
  }

  newFormat() {
    return this.field_id_preview || this.field_id_pin || this.field_id_caption || this.force_new_format;
  }
};

export function deserializeGame(json) {
  let g = Object.assign(new Game(), json);
  g.created = new Date(g.created);
  return g;
}

export const Colors = class Colors {
  constructor(json) {
    if (json != null) {
      this.colors_id = parseInt(json.colors_id);
      this.name = json.name;
      this.tag_1 = json.tag_1;
      this.tag_2 = json.tag_2;
      this.tag_3 = json.tag_3;
      this.tag_4 = json.tag_4;
      this.tag_5 = json.tag_5;
      this.tag_6 = json.tag_6;
      this.tag_7 = json.tag_7;
      this.tag_8 = json.tag_8;
    }
  }
};

export const Theme = class Theme {
  constructor(json) {
    if (json != null) {
      this.theme_id     = parseInt(json.theme_id);
      this.name         = json.name;
      this.gmaps_styles = json.gmaps_styles;
    }
  }
};

export const User = class User {
  constructor(json) {
    if (json != null) {
      this.user_id = parseInt(json.user_id);
      this.display_name = json.display_name || json.user_name;
      this.media_id = parseInt(json.media_id);
    }
  }
};

export function arisHTTPS(x) {
  if (typeof x === "string") {
    return x.replace("http://arisgames.org", "https://arisgames.org");
  } else {
    return x;
  }
}

export const Tag = class Tag {
  constructor(json) {
    var ref, ref1;
    if (json != null) {
      this.icon_url = arisHTTPS(
        (ref = json.media) != null
          ? (ref1 = ref.data) != null
            ? ref1.url
            : undefined
          : undefined
      );
      this.tag = json.tag;
      this.tag_id = parseInt(json.tag_id);
      this.game_id = parseInt(json.game_id);
      this.sort_index = parseInt(json.sort_index);
      this.color = json.color;
    } else {
      this.icon_url = null;
      this.tag = null;
      this.tag_id = null;
      this.game_id = null;
      this.sort_index = null;
      this.color = null;
    }
  }

  createJSON() {
    return {
      tag_id: this.tag_id || undefined,
      game_id: this.game_id,
      tag: this.tag,
      color: this.color || undefined
    };
  }
};

export const Comment = class Comment {
  constructor(json) {
    if (json != null) {
      this.description = json.description;
      this.comment_id = parseInt(json.note_comment_id);
      this.user = new User(json.user);
      this.created = new Date(json.created.replace(" ", "T") + "Z");
      this.note_id = parseInt(json.note_id);
    }
  }
};

export const Note = class Note {
  constructor(json = null) {
    var comment,
      o,
      ref,
      ref1,
      ref10,
      ref11,
      ref12,
      ref13,
      ref14,
      ref15,
      ref16,
      ref17,
      ref2,
      ref3,
      ref4,
      ref5,
      ref6,
      ref7,
      ref8,
      ref9;
    if (json != null) {
      this.note_id = parseInt(json.note_id);
      this.game_id = parseInt(json.game_id);
      if (json.user != null) {
        this.user = new User(json.user);
      } else {
        this.user = new User({
          user_id: json.user_id,
          display_name: json.display_name || json.user_name,
          media_id: json.user_media_id,
        });
      }
      this.description = json.description;
      this.media_id = parseInt(
        (ref = json.media) != null
          ? (ref1 = ref.data) != null
            ? ref1.media_id
            : undefined
          : undefined
      );
      this.photo_url =
        0 ===
          parseInt(
            (ref2 = json.media) != null
              ? (ref3 = ref2.data) != null
                ? ref3.media_id
                : undefined
              : undefined
          ) || 0 === parseInt(json.media_id)
          ? null
          : arisHTTPS(
              (ref4 = (ref5 = json.media) != null ? ref5.url : undefined) !=
              null
                ? ref4
                : (ref6 = json.media) != null
                  ? (ref7 = ref6.data) != null
                    ? ref7.url
                    : undefined
                  : undefined
            );
      this.thumb_url =
        0 ===
          parseInt(
            (ref8 = json.media) != null
              ? (ref9 = ref8.data) != null
                ? ref9.media_id
                : undefined
              : undefined
          ) || 0 === parseInt(json.media_id)
          ? null
          : arisHTTPS(
              (ref10 =
                (ref11 = json.media) != null
                  ? ref11.big_thumb_url
                  : undefined) != null
                ? ref10
                : (ref12 = json.media) != null
                  ? (ref13 = ref12.data) != null
                    ? ref13.big_thumb_url
                    : undefined
                  : undefined
            );
      this.latitude = parseFloat(
        (ref14 = json.latitude) != null
          ? ref14
          : (ref15 = json.trigger) != null
            ? ref15.latitude
            : undefined
      );
      this.longitude = parseFloat(
        (ref16 = json.longitude) != null
          ? ref16
          : (ref17 = json.trigger) != null
            ? ref17.longitude
            : undefined
      );
      this.tag_id = parseInt(json.tag_id);
      this.created =
        json.created != null
          ? new Date(json.created.replace(" ", "T") + "Z")
          : null;
      this.player_liked =
        json.player_liked != null && !!parseInt(json.player_liked);
      this.note_likes = parseInt(json.note_likes);
      this.comments = (function() {
        var i, len, ref18, ref19, ref20, ref21, results;
        ref20 =
          (ref18 = (ref19 = json.comments) != null ? ref19.data : undefined) !=
          null
            ? ref18
            : [];
        results = [];
        for (i = 0, len = ref20.length; i < len; i++) {
          o = ref20[i];
          comment = new Comment(o);
          if (
            !((ref21 = comment.description) != null
              ? ref21.match(/\S/)
              : undefined)
          ) {
            continue;
          }
          results.push(comment);
        }
        return results;
      })();
      this.published = json.published;
      this.field_data = {};
      if (Array.isArray(json.field_data)) {
        this.field_data = json.field_data;
      } else {
        for (const k in json) {
          if (k.indexOf('field_') === 0) {
            const n = parseInt(k.slice('field_'.length))
            this.field_data[n] = json[k];
          }
        }
      }
    }
  }
};

export function deserializeNote(json) {
  var n, o;
  n = Object.assign(new Note(), json);
  n.user = Object.assign(new User(), n.user);
  n.created = new Date(n.created);
  n.comments = n.comments && n.comments.map(o => Object.assign(new Comment(), o));
  return n;
}

export const Field = class Field {
  constructor(json = null) {
    if (json != null) {
      this.field_id = parseInt(json.field_id);
      this.game_id = parseInt(json.game_id);
      this.field_type = json.field_type;
      this.label = json.label;
      this.required = !!parseInt(json.required);
      this.sort_index =
        json.sort_index != null ? parseInt(json.sort_index) : null;
      this.min = parseFloat(json.min);
      this.max = parseFloat(json.max);
      this.step = parseFloat(json.step);
      this.min_color = json.min_color;
      this.max_color = json.max_color;
      this.quest_id = parseInt(json.quest_id);
      this.field_option_id = parseInt(json.field_option_id);
      this.instruction = json.instruction;
    }
  }
};

export const FieldOption = class FieldOption {
  constructor(json = null) {
    if (json != null) {
      this.field_option_id = parseInt(json.field_option_id);
      this.field_id = parseInt(json.field_id);
      this.game_id = parseInt(json.game_id);
      this.option = json.option;
      this.sort_index =
        json.sort_index != null ? parseInt(json.sort_index) : null;
      this.color = json.color;
      this.remnant_id = parseInt(json.remnant_id);
      this.field_guide_id = parseInt(json.field_guide_id);
    }
  }
};

export const FieldData = class FieldData {
  constructor(json = null) {
    if (json != null) {
      this.field_data_id = parseInt(json.field_data_id);
      this.note_id = parseInt(json.note_id);
      this.field_id = parseInt(json.field_id);
      this.field_data = json.field_data;
      this.media_id = parseInt(json.media_id);
      this.media = json.media;
      this.field_option_id = parseInt(json.field_option_id);
    }
  }
};

export function displayError(err) {
  if (err.returnCodeDescription != null) {
    Alert.alert("Error", err.returnCodeDescription);
  }
}

function sortByIndex(key_id) {
  return function(a, b) {
    if (a.sort_index != null && b.sort_index != null) {
      return a.sort_index - b.sort_index;
    } else if (a.sort_index != null) {
      return 1;
    } else if (b.sort_index != null) {
      return -1;
    } else {
      return a[key_id] - b[key_id];
    }
  };
}

let activeCalls = 0;
const MAX_CALLS = 15;
const pendingCalls = [];

// Handles Aris v2 authentication and API calls.
export const Auth = class Auth {
  constructor(json = null) {
    this.authToken =
      json != null
        ? {
            user_id: parseInt(json.user_id),
            permission: "read_write",
            key: json.read_write_key,
            username: json.user_name,
            display_name: json.display_name,
            media_id: json.media_id,
            email: json.email
          }
        : null;
    this.bio = json != null ? json.bio : undefined;
    this.url = json != null ? json.url : undefined;
  }

  rawUpload(file, reportProgress, cb) {
    var form, handleError, req, tries;
    req = new XMLHttpRequest();
    req.open("POST", `${ARIS_URL}/rawupload.php`, true);
    req.onload = () => {
      var ref;
      if (200 <= (ref = req.status) && ref < 400) {
        return cb({
          returnCode: 0,
          data: req.responseText
        });
      } else {
        return handleError(req.status);
      }
    };
    req.onerror = () => {
      return handleError(req.responseText);
    };
    req.upload.addEventListener(
      "progress",
      evt => {
        if (evt.lengthComputable) {
          return reportProgress(evt.loaded / evt.total);
        }
      },
      false
    );
    form = new FormData();
    form.append("raw_upload", file);
    // don't set timeout, because media upload could take a long time
    tries = 999;
    handleError = error => {
      if (req.readyState === req.OPENED) {
        if (tries === 0) {
          return cb({ error });
        } else {
          tries -= 1;
          return req.send(form);
        }
      } else {
        // this probably means user went into airplane mode or is now offline
        return cb({ error });
      }
    };
    req.send(form);
    return req;
  }

  loadSavedAuth(cb) {
    var ref, useJSON;
    if (this.authToken != null) {
      cb(this.authToken);
      return;
    }
    useJSON = json => {
      if (json != null) {
        cb(JSON.parse(json));
      } else {
        cb(null);
      }
    };
    AsyncStorage.getItem("aris-auth", (err, result) => {
      useJSON(result);
    });
  }

  call(func, json, cb = (() => {})) {
    if (activeCalls >= MAX_CALLS) {
      var aborted = false;
      pendingCalls.push([func, json, (x) => {
        if (!aborted) {
          cb(x);
        }
      }]);
      // return a fake XHR with just abort method
      return {
        abort: () => {
          const i = pendingCalls.findIndex((call) =>
            call[0] === func && call[1] === json
          );
          if (i !== -1) {
            pendingCalls.splice(i, 1);
          }
          aborted = true
        },
      };
    } else {
      activeCalls++;
      return this.callUnqueued(func, json, (x) => {
        activeCalls--;
        this.popPendingCall();
        cb(x);
      });
    }
  }

  popPendingCall() {
    if (activeCalls < MAX_CALLS && pendingCalls.length > 0) {
      let [func, json, cb] = pendingCalls.shift();
      this.call(func, json, cb);
    }
  }

  callUnqueued(func, json, cb = (() => {})) {
    var req;
    req = new XMLHttpRequest();
    console.log('Server Call Sent: ' + `${ARIS_URL}/json.php/v2.${func}`);
    req.open("POST", `${ARIS_URL}/json.php/v2.${func}`, true);
    req.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
    this.loadSavedAuth(auth => {
      var handleError, jsonString, tries, trySend;
      const password = json.password || this.password;
      if (password != null) {
        auth =
          auth != null
            ? update(auth, {
                password: {
                  $set: password
                }
              })
            : {
                password: password
              };
      }
      json =
        auth != null
          ? update(json, {
              auth: {
                $set: auth
              }
            })
          : json;
      json = update(json, {api: {$set: 2}});
      jsonString = JSON.stringify(json);
      req.onload = () => {
        var ref;
        if (200 <= (ref = req.status) && ref < 400) {
          console.log('Server Call Recieved: ' + req.responseText);
          return cb(JSON.parse(req.responseText));
        } else {
          console.log('Server Call Error: ' +  req.status);
          return handleError(req.status);
        }
      };
      req.onerror = () => {
        handleError("Server Call: Could not connect to Station Server");
      };
      req.ontimeout = () => {
        handleError("Server Call: Request timed out");
      };
      req.timeout = 1000;
      tries = 3;
      trySend = () => {
        if (req.readyState === req.OPENED) {
          return req.send(jsonString);
        } else {
          return cb({
            error: "Could not connect to Station Server",
            errorMore:
              "Make sure you have a working internet connection."
          });
        }
      };
      handleError = error => {
        if (tries === 0) {
          return cb({ error });
        } else {
          tries -= 1;
          return trySend();
        }
      };
      return trySend();
    });
    return req;
  }

  useLoginResult(obj, logoutOnFail, cb = function() {}) {
    const { data: json, returnCode, error } = obj;
    if (returnCode === 0 && json.user_id !== null) {
      let auth = new Auth(json);
      if (this.password != null) {
        auth = update(auth, {
          password: {
            $set: this.password
          }
        });
      }
      AsyncStorage.setItem("aris-auth", JSON.stringify(auth.authToken), () => {
        cb(auth);
      });
    } else if (error == null && logoutOnFail) {
      // should only happen if no 'error' meaning we did connect to aris,
      // but then password was wrong or changed or something like that
      this.logout(auth => {
        cb(auth, obj);
      });
    }
  }

  login(username, password, cb = function() {}) {
    return this.call(
      "users.logIn",
      {
        user_name: username,
        password: password,
        permission: "read_write",
        siftr_version: 20190301,
      },
      obj => {
        return this.useLoginResult(obj, true, cb);
      }
    );
  }

  register(username, password, email, cb = function() {}) {
    return this.call(
      "users.createUser",
      {
        user_name: username,
        password: password,
        email: email
      },
      obj => {
        return this.useLoginResult(obj, true, cb);
      }
    );
  }

  changePassword({ username, oldPassword, newPassword }, cb = function() {}) {
    return this.call(
      "users.changePassword",
      {
        user_name: username,
        old_password: oldPassword,
        new_password: newPassword
      },
      obj => {
        return this.useLoginResult(obj, false, cb);
      }
    );
  }

  editProfile(
    { display_name, url, bio, newPicture },
    updateProgress = function() {},
    cb = function() {}
  ) {
    var withMediaID;
    withMediaID = media_id => {
      return this.call(
        "users.updateUser",
        {
          display_name: display_name,
          url: url,
          bio: bio,
          media_id: media_id
        },
        obj => {
          return this.useLoginResult(obj, false, cb);
        }
      );
    };
    if (newPicture != null) {
      return uploadImage(
        newPicture,
        this,
        null,
        updateProgress,
        ({ media }) => {
          return withMediaID(media.media_id);
        }
      );
    } else {
      return withMediaID(undefined);
    }
  }

  logout(cb = function() {}) {
    var auth;
    AsyncStorage.removeItem("aris-auth", () => {
      cb(new Auth());
    });
  }

  // Perform an ARIS call, but then wrap a successful result with a class.
  callWrapped(func, json, cb, wrap, unqueued = false) {
    return this[unqueued ? 'callUnqueued' : 'call'](func, json, result => {
      if (result.returnCode === 0 && result.data != null) {
        result.data = wrap(result.data);
      }
      return cb(result);
    });
  }

  promise(method, ...args) {
    return new Promise((resolve, reject) => {
      return this[method].call(this, ...args, result => {
        if (result.returnCode === 0) {
          return resolve(result.data);
        } else {
          return reject(result);
        }
      });
    });
  }

  getGame(json, cb) {
    this.callWrapped("games.getGame", json, cb, function(data) {
      return new Game(data);
    });
  }

  searchSiftrs(json, cb) {
    this.callWrapped("games.searchSiftrs", json, cb, function(data) {
      return data.map(o => new Game(o));
    });
  }

  siftrSearch(json, cb) {
    return this.callWrapped("notes.siftrSearch", json, cb, function(data) {
      var o;
      return {
        notes: data.notes.map(o => new Note(o)),
        map_notes: data.map_notes.map(o => new Note(o)),
        map_clusters: data.map_clusters
      };
    }, true);
  }

  getTagsForGame(json, cb) {
    this.callWrapped("tags.getTagsForGame", json, cb, function(data) {
      let tags = data.map(o => new Tag(o));
      tags.sort(sortByIndex("tag_id"));
      return tags;
    });
  }

  getUsersForGame(json, cb) {
    return this.callWrapped("users.getUsersForGame", json, cb, function(data) {
      return data.map(o => new User(o));
    });
  }

  getFieldsForGame(json, cb) {
    this.callWrapped("fields.getFieldsForGame", json, cb, function(data) {
      var field, fields, i, len, o, opt;
      fields = data.fields.map(o => new Field(o));
      fields.sort(sortByIndex("field_id"));
      const options = data.options.map(o => new FieldOption(o));
      for (i = 0, len = fields.length; i < len; i++) {
        field = fields[i];
        field.options = (function() {
          var j, len1, results;
          results = [];
          for (j = 0, len1 = options.length; j < len1; j++) {
            opt = options[j];
            if (field.field_id === opt.field_id) {
              results.push(opt);
            }
          }
          return results;
        })();
        field.options.sort(sortByIndex("field_option_id"));
      }
      return {fields: fields, guides: data.guides};
    });
  }

  getGamesForUser(json, cb) {
    this.callWrapped("games.getGamesForUser", json, cb, function(data) {
      return data.map(o => new Game(o));
    });
  }

  searchNotes(json, cb) {
    return this.callWrapped("notes.searchNotes", json, cb, function(data) {
      return data.map(o => new Note(o));
    });
  }

  createGame(game, cb) {
    this.callWrapped("games.createGame", game.createJSON(), cb, function(data) {
      return new Game(data);
    });
  }

  updateGame(game, cb) {
    this.callWrapped("games.updateGame", game.createJSON(), cb, function(data) {
      return new Game(data);
    });
  }

  getColors(json, cb) {
    this.callWrapped("colors.getColors", json, cb, function(data) {
      return new Colors(data);
    });
  }

  getTheme(json, cb) {
    this.callWrapped("themes.getTheme", json, cb, function(data) {
      return new Theme(data);
    });
  }

  createTag(tag, cb) {
    this.callWrapped("tags.createTag", tag.createJSON(), cb, function(data) {
      return new Tag(data);
    });
  }

  updateTag(json, cb) {
    this.callWrapped("tags.updateTag", json, cb, function(data) {
      return new Tag(data);
    });
  }

  createNoteComment(json, cb) {
    this.callWrapped("note_comments.createNoteComment", json, cb, function(
      data
    ) {
      return new Comment(data);
    });
  }

  updateNoteComment(json, cb) {
    this.callWrapped("note_comments.updateNoteComment", json, cb, function(
      data
    ) {
      return new Comment(data);
    });
  }

  getNoteCommentsForNote(json, cb) {
    this.callWrapped("note_comments.getNoteCommentsForNote", json, cb, function(
      data
    ) {
      return data.map(o => new Comment(o));
    });
  }

  getFieldDataForNote(json, cb) {
    this.callWrapped("fields.getFieldDataForNote", json, cb, function(data) {
      return data.map(o => new FieldData(o));
    });
  }

  getFollowedGamesForUser(json, cb) {
    this.callWrapped("games.getFollowedGamesForUser", json, cb, function(data) {
      return data.map(o => new Game(o));
    });
  }

  getStaffPicks(json, cb) {
    this.callWrapped("games.getStaffPicks", json, cb, function(data) {
      return data.map(o => new Game(o));
    });
  }

  getNearbyGamesForPlayer(json, cb) {
    this.callWrapped("client.getNearbyGamesForPlayer", json, cb, function(
      data
    ) {
      return data.map(o => new Game(o));
    });
  }

  getAllStemportsStations(cb) {
    this.callWrapped("games.getAllStemportsStations", {}, cb, function(data) {
      return data.map(o => new Game(o));
    });
  }
};

export const arisPromise = (fn) => {
  return new Promise((resolve, reject) => {
    fn(res => {
      if (res.returnCode === 0) {
        resolve(res.data);
      } else {
        reject(res.returnCodeDescription);
      }
    });
  });
};