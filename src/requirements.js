'use strict';

export function evalReqPackage(req, env) {
  if (req.ands.length === 0) {
    return true;
  }
  for (var i = 0; i < req.ands.length; i++) {
    if (evalReqAndPackage(req.ands[i], env)) return true;
  }
  return false;
}

function evalReqAndPackage(and, env) {
  for (var i = 0; i < and.atoms.length; i++) {
    if (!evalReqAtom(and.atoms[i], env)) return false;
  }
  return true;
}

function playerViewed(atom, type, log) {
  return log.some(logEntry =>
       logEntry.event_type === `VIEW_${type}`
    && logEntry.content_id === atom.content_id
  );
}

function playerCompletedQuest(atom, log) {
  return log.some(logEntry =>
       logEntry.event_type === 'COMPLETE_QUEST'
    && logEntry.content_id === atom.content_id
  );
}

function playerHasItem(atom, instances) {
  return instances.some(instance =>
       instance.owner_type === 'USER'
    // && instance.owner_id === (player's user id)
    && instance.object_type === 'ITEM'
    && parseInt(instance.object_id) === parseInt(atom.content_id)
    && parseInt(instance.qty) >= parseInt(atom.qty)
  );
}

function playerHasNoteWithTag(atom, env) {
  const user_id = parseInt(env.auth.authToken.user_id);
  const tag_id = parseInt(atom.content_id);
  const hasTag = (tag_id > 10000000) ? (note => {
    if (!note.field_data) {
      return false;
    } else if (note.field_data.some) {
      return note.field_data.some(field_data =>
        parseInt(field_data.field_id) === parseInt(env.game.field_id_pin)
        && parseInt(field_data.field_option_id) === tag_id - 10000000
      );
    } else {
      const field_data = note.field_data[env.game.field_id_pin];
      return parseInt(field_data) === tag_id - 10000000
    }
  }) : (note =>
    false // not implemented
  );
  const qty = env.notes.filter(note =>
    parseInt(note.user_id || (note.user && note.user.user_id)) === user_id
    && hasTag(note)
  ).length;
  return qty >= parseInt(atom.qty);
}

function evalReqAtom(atom, env) {
  const bool_operator = !!(atom.bool_operator);
  const {log, instances, notes} = env;
  switch (atom.requirement) {
    case 'ALWAYS_TRUE':
      return bool_operator;
    case 'ALWAYS_FALSE':
      return !bool_operator;
    case 'PLAYER_HAS_ITEM':
      return bool_operator == playerHasItem(atom, instances);
    case 'PLAYER_HAS_TAGGED_ITEM':
      return !bool_operator; // TODO
    case 'GAME_HAS_ITEM':
      return !bool_operator; // TODO
    case 'GAME_HAS_TAGGED_ITEM':
      return !bool_operator; // TODO
    case 'GROUP_HAS_ITEM':
      return !bool_operator; // TODO
    case 'GROUP_HAS_TAGGED_ITEM':
      return !bool_operator; // TODO
    case 'PLAYER_VIEWED_ITEM':
      return bool_operator == playerViewed(atom, 'ITEM', log);
    case 'PLAYER_VIEWED_PLAQUE':
      return bool_operator == playerViewed(atom, 'PLAQUE', log);
    case 'PLAYER_VIEWED_DIALOG':
      return bool_operator == playerViewed(atom, 'DIALOG', log);
    case 'PLAYER_VIEWED_DIALOG_SCRIPT':
      return bool_operator == playerViewed(atom, 'DIALOG_SCRIPT', log);
    case 'PLAYER_VIEWED_WEB_PAGE':
      return bool_operator == playerViewed(atom, 'WEB_PAGE', log);
    case 'PLAYER_RAN_EVENT_PACKAGE':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_UPLOADED_MEDIA_ITEM':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_UPLOADED_MEDIA_ITEM_IMAGE':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_UPLOADED_MEDIA_ITEM_AUDIO':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_UPLOADED_MEDIA_ITEM_VIDEO':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_COMPLETED_QUEST':
      return bool_operator == playerCompletedQuest(atom, log);
    case 'PLAYER_HAS_QUEST_STARS':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_RECEIVED_INCOMING_WEB_HOOK':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_NOTE':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_NOTE_WITH_TAG':
      return bool_operator == playerHasNoteWithTag(atom, env);
    case 'PLAYER_HAS_NOTE_WITH_LIKES':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_NOTE_WITH_COMMENTS':
      return !bool_operator; // TODO
    case 'PLAYER_HAS_GIVEN_NOTE_COMMENTS':
      return !bool_operator; // TODO
  }
}
