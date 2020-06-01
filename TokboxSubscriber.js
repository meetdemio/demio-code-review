import debug from 'debug'
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
  },
  // @TODO restrictFrameRate(true) false to disable t
  // @TODO setPreferredResolution({width: 320, height: 240}) or 640x480"? null to disabled it
}

export function tokboxSubscribe ({ stream, options: { testNetwork, ...options } = {}, className }) {
   // @TODO fix for stream duplication??
  let audioLevel = 0

  const subscription = tokboxSession
    .subscribe(stream, { ...subscriberOptions, testNetwork, ...options } , (error) => {
      if (error) return console.error(error)
    })
    .on('videoElementCreated', ({ element }) => {
      const demioVideoElement = autoplayStream({ 
        stream: subscription.stream, 
        demioVideoElement: element, 
        className
      }) 
      subscription.demioVideoElement = demioVideoElement
      emitLocalEvent('TokboxSession:streamCreated', { ...subscription.stream, demioVideoElement, testNetwork })
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
    })
    
  return subscription
}
