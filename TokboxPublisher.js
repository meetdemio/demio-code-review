import OpenTok from '@opentok/client'
import debug from 'debug'
import { emitLocalEvent, onLocalEvent } from 'libs/localEvents'
import { autoplayStream, destroyAutoplayStream } from 'libs/audioAutoplay'
import { tokboxSession } from 'libs/TokboxSession'
import { tokboxSubscribe } from 'libs/TokboxSubscriber'
import { onPublisherMediaStopped, onPublisherStreamDestroyed, getAudioLevelUpdated } from 'libs/TokboxSessionHelpers'

const log = debug('demio:TokboxPublisher')
let publisher

const publisherOptions = {
  insertDefaultUI: false,
  showControls: false,
  resolution: '1280x720', // monitor with MediaStreamTrack.getConstraints()
  audioSource: false,
  videoSource: false,
  publishAudio: false,
  publishVideo: false,
  audioFallbackEnabled: false,
  // You may want to set this to true when publishing 
  // high-quality audio (by setting the audioBitrate) 
  // to disable echo cancellation, automatic gain control, and noise suppression
  disableAudioProcessing: false,
  // Bits per second 20000 (Speech HD Wideband)
  // The following needs hardware that supports frequency range of 20 Hz to 20 kHz
  // 28000-40000 (Speech Fullband - Medium quality)
  // 48000-64000 (Music - Highest quality)
  audioBitrate: 40000,
  facingMode: 'user', // or 'environment'
  frameRate: 30, // or 15 (monitor with MediaStreamTrack.getConstraints())
  maxResolution: { // For screen sharing
    width: 1280,
    height: 720
  },
  name: 'stream',
  mirror: false
}


function getPublisherOptions ({ micEnabled, camEnabled, name, lastname }, { smart } = {}) {
  const { audioSource, videoSource } = getPublisherSources()
  return {
    ...publisherOptions,
    audioSource: (micEnabled || smart) ? audioSource : false,
    videoSource: (camEnabled || smart) ? videoSource : false,
    publishAudio: micEnabled,
    publishVideo: camEnabled,
    name: name + (lastname ? ' ' + lastname : '')
  }
}

function getPublisherSources () {
  const { micDevID, webcamDevID } = JSON.parse(localStorage.iosettings || null) || {}
  const { isWebsiteHasWebcamPermissions, isWebsiteHasMicrophonePermissions, hasMicrophone, hasWebcam } = DetectRTC
  let theWebcamDevID = hasWebcam 
  let theMicDevID = hasMicrophone
  if (isWebsiteHasWebcamPermissions && webcamDevID) theWebcamDevID = webcamDevID
  if (isWebsiteHasMicrophonePermissions && micDevID) theMicDevID = micDevID
  
  return {
    audioSource: theMicDevID,
    videoSource: theWebcamDevID
  }
}

function destroyPublisher () {
  if (!publisher) return
  destroyAutoplayStream(publisher.streamId)
  publisher.destroy()
}

function onInitPublisherError ({ error, error: { name } = {}, options: { videoSource, audioSource } }) {  
  if (['OT_CONSTRAINTS_NOT_SATISFIED', 'OT_HARDWARE_UNAVAILABLE'].includes(name)) {
    // TODO: get rid of notifyDialog emitLocalEvent('showErrorNotification', 'Establishing mic stream failed...')
    DEMIO.ui.notifyDialog(
      'Establishing device stream failed. Ensure the device is properly connected and correctly selected in the Demio settings and try again.'
    )
  }
  if (["OT_USER_MEDIA_ACCESS_DENIED", "OT_NO_DEVICES_FOUND"].includes(name)) {
    emitLocalEvent('showInfoNoPermissions', { videoSource, audioSource })
  }
  if (["OT_HARDWARE_UNAVAILABLE", "OT_CHROME_MICROPHONE_ACQUISITION_ERROR"].includes(name)) {
    emitLocalEvent('showNotReadableError')
  }
  if ("OT_CHROME_MICROPHONE_ACQUISITION_ERROR" === name) {
    emitLocalEvent('showNotReadableError')
  }

  // TODO: Retry to publish???
  emitLocalEvent('TokboxSession:initPublisher:error', { error, videoType: videoSource })
  if ("OT_USER_MEDIA_ACCESS_DENIED" !== name) {
    Raven.captureException(error)
  }
  log('initPublisher error', error)
}

function createPublisher ({ micEnabled, camEnabled, name, lastname, userID }, { smart } = {}) {
  const options = getPublisherOptions({ micEnabled, camEnabled, name, lastname }, { smart })
  let myPublisher = OpenTok.initPublisher(options, (error) => error && onInitPublisherError({ error, options }))

  // State of the mic & cam to publish using the same instance
  myPublisher.demioMicEnabled = micEnabled
  myPublisher.demioCamEnabled = camEnabled
  
  let audioLevel = 0

  myPublisher.on({
    videoElementCreated: ({ element }) => {
      myPublisher.demioVideoElement = element
      element.onloadedmetadata = function () {
        // Hack for autoplay when MediaStream is updated when the cam is enabled after the mic
        let { demioVideoElement, demioVideoElement: { srcObject } = {} } = myPublisher
        if (srcObject && srcObject.id !== this.srcObject.id) {
          demioVideoElement.srcObject = this.srcObject
          demioVideoElement.play()
        }
      }
    },
    streamCreated: ({ stream }) => {
      emitLocalEvent('indicate:majorissue', null)
      
      // Stream monitor from network
      tokboxSubscribe({ stream, options: { testNetwork: true }, className: 'is-publisher-monitor' })
      
      // Real stream from webcam
      const demioVideoElement = autoplayStream(myPublisher) 
      myPublisher.demioVideoElement = demioVideoElement
      emitLocalEvent('TokboxSession:streamCreated', { ...stream, demioVideoElement, userID })
    },
    streamDestroyed (event) {
      if (event.reason !== 'reset') {
        publisher = null
        onPublisherStreamDestroyed(event)
      }
    },
    mediaStopped: () => {
      notification.warning({
        duration: 3,
        message: 'Media stream stopped',
        description: 'If this is not intentional check that the devices are connected correctly.'
      })
    },
    audioLevelUpdated: (event) => {
      audioLevel = getAudioLevelUpdated(event, audioLevel, (siglevel) => {
        emitLocalEvent('presenters:publisher:audioLevelUpdated', siglevel + '%')
        // TODO: Do not access the DOM directly and use the event presenters:audioLevelUpdated
        let micsig = document.querySelectorAll('.mic.sig-lvl')
        if (micsig.length) {
          micsig.forEach((element) => element.style.height = siglevel + '%')
        }
      })
    }
  })

  return myPublisher
}

function publish ({ micEnabled, camEnabled, name, lastname, userID }) {
  if (!publisher) return initPublisher ({ micEnabled, camEnabled, name, lastname, userID })
  
  if (micEnabled !== publisher.demioMicEnabled) {
    publisher.demioMicEnabled = micEnabled
    publisher.publishAudio(micEnabled)
  }
  if (camEnabled !== publisher.demioCamEnabled) {
    publisher.demioCamEnabled = camEnabled
    publisher.publishVideo(camEnabled)
  }
  // TODO: Update layout - render a react component, a portal?
  emitLocalEvent('TokboxSession:streamUpdated:publisher', { ...publisher, hasAudio: micEnabled, hasVideo: camEnabled, userID })
}

function initPublisher ({ micEnabled, camEnabled, name, lastname, userID }) {    
  if (!micEnabled && !camEnabled) return

  publisher = createPublisher({ micEnabled, camEnabled, name, lastname, userID }, { smart: true })
  tokboxSession.publish(publisher, (error) => {
    if (error) {
      publisher = null
      log('TokboxSession:publisher:error', error)
      return emitLocalEvent('TokboxSession:publisher:error', error)
    }
    emitLocalEvent('TokboxSession:publisher:streaming')
  })
}

function changeAudioSource ({ micDevID, micEnabled }) {
  publisher.setAudioSource(micDevID)
  // Is required to re-publish the audio?
  if (micEnabled) publisher.publishAudio(true)
}

function changeVideoSource ({ micDevID, camEnabled }) {
  publisher.cycleVideo()
    .then(({ deviceId }) => {
      // Recursive call because maybe there is more than one webcam?
      if (deviceId !== micDevID) changeVideoSource({ micDevID, camEnabled })
    })
    .catch(error => {
      console.error(error)
    })
  // Is required to re-publish the video?
  // if (camEnabled) publisher.publishVideo(true)
}

export default publisher
export { initPublisher, publish, destroyPublisher, getPublisherOptions, changeAudioSource, changeVideoSource, publisherOptions }