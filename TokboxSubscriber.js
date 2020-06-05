import debug from 'debug'
import OpenTok from '@opentok/client'
import { emitLocalEvent, onLocalEvent } from 'libs/localEvents'
import { autoplayStream, destroyAutoplayStream } from 'libs/audioAutoplay'
import { tokboxSession } from 'libs/TokboxSession'
import { getAudioLevelUpdated } from 'libs/TokboxSessionHelpers'
import { Kit } from 'demio-ui-kit/src'

const { notification } = Kit
const log = debug('demio:TokboxSessionHelpers')

const subscriberOptions = {
  insertDefaultUI: false,
  showControls: false,
  preferredFrameRate: 30,
  testNetwork: false,
  preferredResolution: {
    width: 1280,
    height: 720
  }
}

export function tokboxSubscribe ({ stream, options: { testNetwork, ...options } = {}, className }) {
  // @TODO do we still need the fix for duplicated stream??
  // Probably that was a bug in the previous integration
  let audioLevel = 0

  const subscription = tokboxSession
    .subscribe(stream, { ...subscriberOptions, testNetwork, ...options } , (error) => {
      if (error) {
        log(error)
        return console.error(error)
      }
    })
    .on('videoElementCreated', ({ element }) => {
      const demioVideoElement = autoplayStream({ 
        stream: subscription.stream, 
        demioVideoElement: element, 
        className
      }) 
      subscription.demioVideoElement = demioVideoElement
      emitLocalEvent('TokboxSession:streamCreated', { ...subscription.stream, demioVideoElement, testNetwork })
      log('Subscriber:videoElementCreated', element)
    })
    .on('audioLevelUpdated', (event) => {
      audioLevel = getAudioLevelUpdated(event, audioLevel, (siglevel) => {
        if (event.target && event.target.stream && event.target.stream.connection) {
          const { userId: userID } = JSON.parse(event.target.stream.connection.data) || {}
          if (userID) {
            emitLocalEvent('Presenters:audioLevel', {
              userID,
              audioLevel: siglevel / 100
            })
          }
        }
      })
      // log('Subscriber:audioLevelUpdated', event)
    })
    
  return subscription
}

// TODO: Use for the layout with shared materials because the webcam size is much smaller
export function restrictFrameRate ({ streamID, restrict = true }) {
  const [subscriber] = OpenTok.subscribers.where({ streamID })
  if (subscriber) subscriber.restrictFrameRate(restrict)
}

export function setPreferredResolution ({ streamID, unset = false }) {
  const [subscriber] = OpenTok.subscribers.where({ streamID })
  // 320x240 or 640x480??
  if (subscriber) subscriber.setPreferredResolution(unset ? null : { width: 320, height: 240 }) 
}
