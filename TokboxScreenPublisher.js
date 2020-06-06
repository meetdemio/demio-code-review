import OpenTok from '@opentok/client'
import debug from 'debug'
import config from '../../../config'
import { } from 'libs/helpers'
import { emitLocalEvent, onLocalEvent } from 'libs/localEvents'
import { tokboxSession } from 'libs/TokboxSession'
import { onPublisherMediaStopped, onPublisherStreamDestroyed } from 'libs/TokboxSessionHelpers'
import { publisherOptions } from 'libs/TokboxPublisher'
import { tokboxSubscribe } from 'libs/TokboxSubscriber'
import { Kit } from 'demio-ui-kit/src'

const { notification } = Kit
const log = debug('demio:TokboxPublisher')

let screenPublisher
let creatingScreenPublisher
const notificationDuration = 3

function setScreenPublisherHandlers (myPublisher) {
  myPublisher.on({
    videoElementCreated: ({ element }) => {
      myPublisher.demioVideoElement = element
    },
    streamCreated: ({ stream }) => {
      emitLocalEvent('indicate:majorissue', null)
      // Stream monitor from network
      tokboxSubscribe({ stream, options: { testNetwork: true }, className: 'is-publisher-monitor' })
      emitLocalEvent('TokboxSession:streamCreated', { ...stream, demioVideoElement: myPublisher.demioVideoElement })
      emitLocalEvent('ScreenSharing:started', myPublisher.demioVideoElement)
    },
    streamDestroyed: (event) => {
      const { reason, type, stream } = event
      if (reason === 'forceUnpublished') {
        // Other user is taking over
      }
      if (reason === 'networkDisconnected') {
        // TODO: the screen sharing is destroyed because of network issues
        // We could try to start it again
        notification.warning({
          duration: notificationDuration,
          message: 'Screenshare stream stopped',
          description: 'The screenshare stream has been disconnected because of a network issue.'
        })
      }
      if (myPublisher && !myPublisher.demioScreenSharedAnother) {
        emitLocalEvent('ScreenSharing:disabled')
        screenPublisher = null
        creatingScreenPublisher = null
        onPublisherStreamDestroyed({ reason, type, stream })
      }
      log('myPublisher:streamDestroyed', event)
    },
    destroyed: (event) => {
      log('myPublisher:destroyed', event)
      if (myPublisher && !myPublisher.demioScreenSharedAnother) {
        setTimeout(() => emitLocalEvent('ScreenSharing:checkUnexpectedStop'), 1500)
      }
    },
    mediaStopped: () => {
      notification.warning({
        duration: notificationDuration,
        message: 'Screenshare stream stopped',
        description: 'If this is not intentional check that the shared window has not been closed.'
      })
    }
  })
}

function onScreenPublisherError (error) {
  const { name, code, message } = error
  log('Screenshare publish error', error)
  
  if (!screenPublisher) {
    emitLocalEvent('ScreenSharing:disabled')
    emitLocalEvent('TokboxSession:initPublisher:error', { error, videoType: 'screen' })
  }
  
  if (!creatingScreenPublisher) return
  
  creatingScreenPublisher.destroy()
  creatingScreenPublisher = null

  if (name !== 'OT_USER_MEDIA_ACCESS_DENIED') {
    notification.warning({
      duration: notificationDuration,
      message: 'Screenshare stream failed',
      description: 'Establishing screenshare stream failed. Please try again.'
    })
    Raven.captureException(error)
  }
}

function createScreenPublisher ({ name, lastname }) {
  let myPublisher = OpenTok.initPublisher({
    ...publisherOptions,
    frameRate: 30, // Test 15
    videoSource: 'screen',
    publishVideo: true,
    name: name + (lastname ? ' ' + lastname : '') + ' shared screen'
  }, (error) => error && onScreenPublisherError(error))

  setScreenPublisherHandlers(myPublisher)

  return myPublisher
}

function tokboxScreenPublish ({ screenSharedEnabled, screenSharedAnother, name, lastname }) {
  const thePublisher = creatingScreenPublisher || screenPublisher

  if (thePublisher && !screenSharedEnabled) {
    if (creatingScreenPublisher) creatingScreenPublisher.destroy()
    if (screenPublisher) screenPublisher.destroy()
    creatingScreenPublisher = null
    screenPublisher = null

    return log('Screenshare has been disabled')
  }

  if (!screenSharedEnabled 
    || creatingScreenPublisher
    || (screenPublisher && !screenSharedAnother)) {
    
    return log('Screenshare is not been enabled or is already enabled')
  }

  creatingScreenPublisher = createScreenPublisher({ name, lastname })
  if (screenSharedAnother) emitLocalEvent('TokboxSession:screenSharedAnother')

  if (!creatingScreenPublisher) {
    return log('Screenshare publisher not created')
  }

  return tokboxSession.publish(creatingScreenPublisher, (error) => {
    if (error) {
      return onScreenPublisherError(error)
    }
    if (screenPublisher) {
      screenPublisher.demioScreenSharedAnother = screenSharedAnother
      screenPublisher.destroy()
      log('Screenshare stream successfully replaced by another')
    }
    screenPublisher = creatingScreenPublisher
    creatingScreenPublisher = null
  })
}

function tokboxScreenUnPublish () {
  const [ screenSharedStream ] = tokboxSession.streams.where({ videoType: 'screen' })
  if (screenSharedStream) tokboxSession.forceUnpublish(screenSharedStream, (error) => {
    if (error) log(error)
  })
} 

export default screenPublisher
export { tokboxScreenPublish, tokboxScreenUnPublish }