'use strict';

import React from 'react';
import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import update from "immutability-helper";

import {Auth, arisHTTPS} from './aris';
import {withSuccess} from './utils';

const mediaDir = `${RNFS.DocumentDirectoryPath}/media`;

// D. J. Bernstein hash function
function djb_hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = 33 * hash ^ str[i].charCodeAt(0);
  }
  return hash;
}

export function loadMedia(props, cb) {
  const online = (props.online == null ? true : props.online);

  function loadFile(file) {
    if (Platform.OS === 'android') {
      cb({uri: 'file://' + file});
    } else {
      cb({uri: file});
    }
  }

  function offline() {
    cb(require('../web/assets/img/no-internet-media.png'));
  }

  function loadGeneral(hash, getURL) {
    const info = mediaDir + '/' + hash + '.txt';
    RNFS.exists(info).then((exists) => {
      if (exists) {
        RNFS.readFile(info, 'utf8').then((filename) => {
          loadFile(mediaDir + '/' + filename);
        });
      } else {
        getURL((url) => {
          if (online) {
            url = arisHTTPS(url);
            let ext = url.split('.').pop().toLowerCase();
            if (ext.length > 4) {
              ext = 'png'; // hack for google maps static pngs, should do better
            }
            const localURL = mediaDir + '/' + hash + '.' + ext;
            RNFS.mkdir(mediaDir, {NSURLIsExcludedFromBackupKey: true}).then(() => {
              return RNFS.downloadFile({
                fromUrl: url,
                toFile: localURL,
              }).promise;
            }).then((result) => {
              return RNFS.writeFile(info, hash + '.' + ext, 'utf8');
            }).then(() => {
              loadFile(localURL);
            });
          } else {
            offline();
          }
        });
      }
    });
  }

  function loadURL(url) {
    if (url.match(/^http/)) {
      loadGeneral('img' + djb_hash(url), (cb) => { cb(url); });
    } else {
      loadFile(url);
    }
  }

  function loadMediaID(media_id, size = 'url') {
    if (!parseInt(media_id)) {
      cb(require('../web/assets/img/stemports-avatar.png'));
      return;
    }
    loadGeneral(size + media_id, (useURL) => {
      if (online) {
        props.auth.call('media.getMedia', {
          media_id: media_id,
        }, withSuccess((media) => {
          useURL(media[size]);
        }));
      } else {
        offline();
      }
    });
  }

  if (props.url == null) {
    if (props.media_id) {
      loadMediaID(props.media_id, props.size);
    }
  } else {
    loadURL(props.url)
  }
}


export class CacheMedia extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      localURL: undefined,
    };
  }

  propsEqual(x, y) {
    return x && y &&
      x.url === y.url &&
      x.media_id === y.media_id &&
      x.size === y.size;
  }

  startLoad() {
    const currentProps = this.props;
    if (this.propsEqual(this._loadingProps, currentProps)) {
      return; // already loading/loaded this media
    }
    this._loadingProps = currentProps;
    loadMedia(this.props, (res) => {
      if (!this._isMounted) return;
      if (!this.propsEqual(this._loadingProps, currentProps)) return; // started loading newer media
      this.setState({localURL: res});
    });
  }

  componentDidMount() {
    this._isMounted = true;
    this.startLoad();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  componentDidUpdate(prevProps, prevState) {
    this.startLoad();
  }

  render() {
    return this.props.withURL(this.state.localURL);
  }
}

export class CacheMedias extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      urls: new Array(props.medias.length),
    };
  }

  startLoad(media, i) {
    loadMedia(media, (res) => {
      if (!this._isMounted) return;
      this.setState((state) => update(state, {urls: {[i]: {$set: res}}}));
    });
  }

  componentDidMount() {
    this._isMounted = true;
    this.props.medias.forEach((media, i) => this.startLoad(media, i));
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // for any new or changed media IDs, clear the url and start loading the new ID
    this.props.medias.forEach((media, i) => {
      const oldMedia = prevProps.medias[i];
      if (!parseInt(media.media_id)) {
        // for local (to-be-uploaded) observations parseInt() returns NaN, so the !== below loops forever
        return;
      }
      if (!oldMedia || parseInt(media.media_id) !== parseInt(oldMedia.media_id)) {
        this.setState(state => update(state, {urls: {[i]: {$set: null}}}));
        this.startLoad(media, i);
      }
    });
    // truncate the list if we now have fewer medias than before
    if (this.props.medias.length !== prevProps.medias.length) {
      this.setState(state => update(state, {
        urls: (ary) => ary.slice(0, this.props.medias.length),
      }));
    }
  }

  render() {
    return this.props.withURLs(this.state.urls);
  }
}