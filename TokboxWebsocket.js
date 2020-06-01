import OpenTok from '@opentok/client'
import socketIOClient from 'socket.io-client'
import debug from 'debug'
import config from '../../../config'
import { isAttendee } from 'libs/helpers'
import TokboxSession from 'libs/TokboxSession'
import { displayStreamingConnectError } from '../components/Viewer/helper'

const log = debug('demio:TokboxWebsocket')
const { tokboxServer } = config

function TokboxWebsocket () {    
  let tokboxWebsocket

  this.connect = ({ user, webinar }) => {
    const { id: userId, role, hasMicPermission, hasCamPermission } = user
    const { id: webinarId } = webinar
  
    tokboxWebsocket = socketIOClient(tokboxServer, {
      forceNew: true,
      transports: ['websocket']
    })

    setEventHandlers()
  
    tokboxWebsocket.on('connect', () => {
      if (isAttendee(role) && (hasMicPermission || hasCamPermission)) {
        return tokboxWebsocket.emit('permission', {
          userId,
          webinarId,
          role,
          pubPermission: true
        })
      }
  
      tokboxWebsocket.emit('join', {
        userId,
        webinarId,
        role,
        tokboxVersion: OpenTok.version
      })
    })
  }

  function setEventHandlers () {
    tokboxWebsocket.on('join_response', ({ sessionId, apiKey, token }) => {
      // @TODO Handle errors
      if (!apiKey) return displayStreamingConnectError()
  
      // OpenTok.checkSystemRequirements() 
      // No need to check system requirements
      TokboxSession({ sessionId, apiKey, token })
      log('socket event join_response', { sessionId, apiKey, token })
    })
  
    tokboxWebsocket.on('permission_response', ({ sessionId, apiKey, token }) => {
      // @TODO Handle errors
      if (!data.apiKey) return displayStreamingConnectError()
      // @TODO Destroy and Disconnect from previous session??
      TokboxSession({ sessionId, apiKey, token })
    })
  }

  return tokboxWebsocket
}

export default new TokboxWebsocket()
