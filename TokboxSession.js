import OpenTok from '@opentok/client'
import debug from 'debug'
import config from '../../../config'
import { } from 'libs/helpers'
import { emitLocalEvent, onLocalEvent } from 'libs/localEvents'
import DetectRTC from 'detectrtc'
import { displayStreamingConnectError } from '../components/Viewer/helper'
import {
  sessionReconnecting,
  sessionReconnected,
  sessionDisconnected,
  sessionConnected,
  connectionCreated,
  connectionDestroyed,
  streamCreated,
  streamDestroyed,
  streamPropertyChanged,
} from 'libs/TokboxSessionHelpers'

const log = debug('demio:TokboxSession')

let tokboxSession

function TokboxSession ({ sessionId, apiKey, token }) {
  // @TODO Get rid of DEMIO.OTSESSION & OTSESSION in other areas
  
  Raven.setExtraContext({ OTTOKEN: token, OTSESSIONID: sessionId })
  Raven.setTagsContext({ OTSESSIONID: sessionId })

  tokboxSession = OpenTok.initSession(apiKey, sessionId)
  tokboxSession.on({
    // Session
    sessionReconnecting,
    sessionReconnected,
    sessionDisconnected,
    sessionConnected,
    // Connection
    connectionCreated,
    connectionDestroyed,
    // Stream
    streamCreated,
    streamDestroyed,
    streamPropertyChanged
  })
  tokboxSession.connect(token, (error) => {
    if (error) {
      Raven.captureException(error)
      displayStreamingConnectError()
    }
  })

  return tokboxSession
}

export default TokboxSession
export { tokboxSession }