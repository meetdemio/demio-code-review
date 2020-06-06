import debug from 'debug'
import { isAttendee, showConnectionLostMessage } from 'libs/helpers'
import { emitLocalEvent, onLocalEvent } from 'libs/localEvents'
import { autoplayStream, destroyAutoplayStream } from 'libs/audioAutoplay'
import { tokboxSubscribe } from 'libs/TokboxSubscriber'
import { Kit } from 'demio-ui-kit/src'

const { notification } = Kit
const log = debug('demio:TokboxSessionHelpers')
const { user: { role } } = window.pageData    
const isUserAttendee = isAttendee(role)

// Session

export function sessionReconnecting () {
  // @TODO emit the event without the role
  emitLocalEvent('indicate:majorissue', {
    note: 'POOR NETWORK',
    reason:
      "You're currently experiencing a poor network connection" +
      (isUserAttendee
        ? '. For more details, you may open settings and run a connectivity test.'
        : ', and the stream quality may suffer as a result. For more details, you may open settings and run a connectivity test.')
  })
}

export function sessionReconnected () {
  emitLocalEvent('indicate:majorissue', null)
}

export function sessionDisconnected ({ reason }) {
  if (reason == 'networkDisconnected') {
    showConnectionLostMessage()
  }
}

export function sessionConnected (event) {
  const { target: { connection: { id: connectionId }, connections, streams } } = event
  
  emitLocalEvent('indicate:majorissue', null)
  emitLocalEvent('TokboxSession:connected', { connections, streams })
  
  log('TokboxSession:connected', event)
  Raven.setTagsContext({ connectionId })
}

// Connection

export function connectionCreated () {}

export function connectionDestroyed () {}

// Stream

export function streamCreated ({ stream }) {
  tokboxSubscribe({ stream })
}

export function streamPropertyChanged ({ changedProperty, stream: { id, hasAudio, hasVideo, demioVideoElement, publisher }}) {
  if (['hasAudio', 'hasVideo'].includes(changedProperty)) {
    emitLocalEvent('TokboxSession:streamUpdated', {
      myPublisher: publisher,
      id, 
      hasAudio, 
      hasVideo,
      demioVideoElement
    })
  }
}

export function streamDestroyed ({ reason, stream: { id, videoType }}) {
  destroyAutoplayStream(id)
  emitLocalEvent('TokboxSession:streamDestroyed', { id, reason, videoType })

  if (reason === 'networkDisconnected') {
    // TODO: a stream I am subscribed to has been destroyed because of the network disconnection
    // It could be my network or the other party
  }
}

// Errors

export function onNetworkDisconnected ({ videoType }) {
  emitLocalEvent('indicate:majorissue', {
    note: 'POOR NETWORK',
    reason: "You're currently experiencing a poor network connection, and the stream quality may suffer as a result. For more details, you may open settings and run a connectivity test."
  })
}

export function onPublisherStreamDestroyed ({ reason, type, stream = {} }) {
  const { hasVideo, hasAudio, videoType, id } = stream
  log('publisher:streamDestroyed', { reason, type })

  destroyAutoplayStream(id)
  if (reason !== 'forceUnpublished') emitLocalEvent('TokboxSession:streamDestroyed:publisher', { videoType })
  if (reason === 'networkDisconnected') onNetworkDisconnected({ videoType })
}

// UI Helpers

export function updateVideoClassList ({ hasAudio, hasVideo, videoType, demioVideoElement: { classList } = {} }, ) {
  if (!classList) return
  
  classList.remove('is-audio-only', 'is-cam-only', 'is-disabled')
  if (videoType === 'screen') return classList.add('is-screen')
  if (!hasVideo && !hasAudio) classList.add('is-disabled')
  if (!hasVideo && hasAudio) classList.add('is-audio-only')
  if (hasVideo && !hasAudio) classList.add('is-cam-only')
}

export function getAudioLevelUpdated (event, audioLevel, callback) {
  let audioLevelUpdated
  if (audioLevel === null || audioLevel <= event.audioLevel) {
    audioLevelUpdated = event.audioLevel
  } else {
    audioLevelUpdated = 0.7 * audioLevel + 0.3 * event.audioLevel
  }

  let logLevel = Math.log(audioLevelUpdated) / Math.LN10 / 1.5 + 1
  logLevel = Math.min(Math.max(logLevel, 0), 1)
  let siglevel = Math.floor(100 * logLevel)

  callback(siglevel)

  return audioLevelUpdated
}