'use strict';

import React from 'react';
import T from 'prop-types';
import createClass from 'create-react-class';
import update from "immutability-helper";

import RNFS from 'react-native-fs';
import analytics from '@react-native-firebase/analytics';

import {Auth} from './aris';
import {loadMedia} from "./media";

import {Platform} from 'react-native';

export function loadQueue() {
  const queueDir = `${RNFS.DocumentDirectoryPath}/siftrqueue`;
  return RNFS.exists(queueDir).then((dirExists) => {
    if (dirExists) {
      return RNFS.readDir(queueDir);
    } else {
      return [];
    }
  }).then((files) => {
    return Promise.all((function() {
      var i, len, results;
      results = [];
      for (i = 0, len = files.length; i < len; i++) {
        let dir, timestamp;
        dir = files[i];
        timestamp = parseInt(dir.name);
        if (!(timestamp && dir.isDirectory())) {
          continue;
        }
        results.push(RNFS.readDir(dir.path).then((entries) => {
          return {dir, entries};
        }));
      }
      return results;
    }).call());
  }).then((listedDirs) => {
    return Promise.all((function() {
      var i, len, results;
      results = [];
      for (i = 0, len = listedDirs.length; i < len; i++) {
        let dir, entries;
        ({dir, entries} = listedDirs[i]);
        if (!entries.some((ent) => {
          return ent.name === 'createNote.json';
        })) {
          continue;
        }
        results.push(RNFS.readFile(`${dir.path}/createNote.json`).then((json) => {
          return {dir, json};
        }));
      }
      return results;
    }).call());
  });
}

export function deleteQueuedNotes(notes) {
  return Promise.all(notes.map(({dir, json}) => RNFS.unlink(dir.path)));
}

export function uploadNote(auth, {dir, json}) {
  json = JSON.parse(json);
  if (!json.files) json.files = [];
  let progress = json.files.map(() => 0);
  return Promise.all(
    json.files.map((f, index) => {
      const file = {
        uri: Platform.OS === 'ios' ? `${dir.path}/${f.filename}` : `file://${dir.path}/${f.filename}`,
        type: f.mimetype,
        name: f.filename
      };
      return auth.promise('rawUpload', file, (fileProg) => {
        progress[index] = fileProg;
        const percent = (progress.reduce((a, b) => a + b, 0) / progress.length) * 100;
      }).then((raw_upload_id) => {
        return auth.promise('call', 'media.createMediaFromRawUpload', {
          file_name: f.filename,
          raw_upload_id: raw_upload_id,
          game_id: f.game_id,
          resize: 800,
        }).then((media) => {
          return {
            media_id: media.media_id,
            field_id: f.field_id,
          };
        });
      });
    })
  ).then((medias) => {
    medias.forEach((m) => {
      if (m.field_id === null) {
        json.media_id = m.media_id;
      } else {
        if (json.field_data === undefined) json.field_data = [];
        json.field_data.push({
          field_id: m.field_id,
          media_id: m.media_id,
        });
      }
    });
    return auth.promise('call', 'notes.createNote', json);
  }).then((note) => {
    analytics().logEvent('create_note', {
      note_id: note.note_id,
      game_id: note.game_id,
    });
    return RNFS.unlink(dir.path);
  }).then(() => {
    // update the notes and media for this station
    const game_id = json.game_id;
    const siftrDir = `${RNFS.DocumentDirectoryPath}/siftrs/${game_id}`;
    const writeJSON = (name) => {
      return (data) => {
        return RNFS.writeFile(
          `${siftrDir}/${name}.txt`,
          JSON.stringify(data)
        ).then(() =>
          ({key: name, data: data}) // return object to generate quests
        );
      };
    };
    return Promise.all([
      auth.promise('siftrSearch', {
        game_id: game_id,
        order: "recent",
        map_data: false,
      }).then(({notes}) =>
        Promise.all(notes.map(note => auth.promise('getFieldDataForNote', {
          note_id: note.note_id,
        }))).then(field_data => {
          return writeJSON('notes')(notes.map((note, i) =>
            update(note, {field_data: {$set: field_data[i]}})
          ));
        })
      ),
      auth.promise('call', 'media.getMediaForGame', {
        game_id: game_id,
      }).then(medias =>
        Promise.all(medias.map(media => new Promise((resolve, reject) => {
          loadMedia({
            media_id: media.media_id,
            auth: auth,
          }, resolve);
        })))
      ),
    ]);
  }).catch((err) => {
    return console.warn(err);
  });
}

export const UploadQueue = createClass({
  displayName: 'UploadQueue',
  propTypes: {
    auth: T.instanceOf(Auth).isRequired,
    online: T.bool
  },
  getDefaultProps: function() {
    return {
      online: true,
      onMessage: function(){},
      onUpload: function(){},
      withPendingNotes: function(){},
    };
  },
  componentDidMount: function() {
    this.mounted = true;
    this.checkQueue();
  },
  componentWillUnmount: function() {
    return this.mounted = false;
  },
  checkQueue: function() {
    if (!this.mounted) {
      return;
    }
    this.loadQueue().then((notes) => {
      this.props.withPendingNotes(notes);
      const count = notes.length + ' post' + (notes.length === 1 ? '' : 's');
      if (notes.length === 0) {
        this.props.onMessage(null);
      } else {
        this.props.onMessage({notes: count, uploading: this.props.online, percent: 0});
      }

      // removed upload function; just checks queue continuously
      setTimeout(() => {
        this.checkQueue();
      }, 3000);
    })
  },
  loadQueue: function() {
    const queueDir = `${RNFS.DocumentDirectoryPath}/siftrqueue`;
    return RNFS.exists(queueDir).then((dirExists) => {
      if (dirExists) {
        return RNFS.readDir(queueDir);
      } else {
        return [];
      }
    }).then((files) => {
      return Promise.all((function() {
        var i, len, results;
        results = [];
        for (i = 0, len = files.length; i < len; i++) {
          let dir, timestamp;
          dir = files[i];
          timestamp = parseInt(dir.name);
          if (!(timestamp && dir.isDirectory())) {
            continue;
          }
          results.push(RNFS.readDir(dir.path).then((entries) => {
            return {dir, entries};
          }));
        }
        return results;
      }).call(this));
    }).then((listedDirs) => {
      return Promise.all((function() {
        var i, len, results;
        results = [];
        for (i = 0, len = listedDirs.length; i < len; i++) {
          let dir, entries;
          ({dir, entries} = listedDirs[i]);
          if (!entries.some((ent) => {
            return ent.name === 'createNote.json';
          })) {
            continue;
          }
          results.push(RNFS.readFile(`${dir.path}/createNote.json`).then((json) => {
            return {dir, json};
          }));
        }
        return results;
      }).call(this));
    });
  },
  uploadNote: function({dir, json}, count) {
    json = JSON.parse(json);
    if (!json.files) json.files = [];
    let progress = json.files.map(() => 0);
    return Promise.all(
      json.files.map((f, index) => {
        const file = {
          uri: Platform.OS === 'ios' ? `${dir.path}/${f.filename}` : `file://${dir.path}/${f.filename}`,
          type: f.mimetype,
          name: f.filename
        };
        return this.props.auth.promise('rawUpload', file, (fileProg) => {
          progress[index] = fileProg;
          const percent = (progress.reduce((a, b) => a + b, 0) / progress.length) * 100;
          this.props.onMessage({notes: count, uploading: true, percent: percent});
        }).then((raw_upload_id) => {
          return this.props.auth.promise('call', 'media.createMediaFromRawUpload', {
            file_name: f.filename,
            raw_upload_id: raw_upload_id,
            game_id: f.game_id,
            resize: 800,
          }).then((media) => {
            return {
              media_id: media.media_id,
              field_id: f.field_id,
            };
          });
        });
      })
    ).then((medias) => {
      medias.forEach((m) => {
        if (m.field_id === null) {
          json.media_id = m.media_id;
        } else {
          if (json.field_data === undefined) json.field_data = [];
          json.field_data.push({
            field_id: m.field_id,
            media_id: m.media_id,
          });
        }
      });
      return this.props.auth.promise('call', 'notes.createNote', json);
    }).then((note) => {
      this.props.onUpload(note);
      analytics().logEvent('ViewFieldNote', {
        station_name: this.props.game.name,
        quest_name: this.props.game.quest_name,
        note_name: note.note_name
      });
      return RNFS.unlink(dir.path);
    }).catch((err) => {
      return console.warn(err);
    });
  },
  render: function() {
    return this.props.children;
  }
});
