
import DetectRTC from 'detectrtc'
import enableInlineVideo from 'iphone-inline-video'
import { isIOS } from 'libs/browser'

export const autoplayStream = ({ stream: { hasVideo, hasAudio, id: streamID }, demioVideoElement, className = '' } = {}) => {
  let videoElement = document.querySelector('body > video')
  
  if (!videoElement || !streamID) {
    return
  }

  videoElement = videoElement.parentElement.removeChild(videoElement) 
  videoElement.id = 'DEMIO_' + streamID
      
  videoElement.removeAttribute('autoplay')
  videoElement.removeAttribute('src')
  videoElement.setAttribute('class', 'demio-video-element ' + className)
  videoElement.muted = true
  videoElement.srcObject = demioVideoElement.srcObject
  videoElement.play()
  setTimeout(() => videoElement.muted = false, 200)
  enableInlineVideo(videoElement)

  return videoElement
}

const createStreamVideo = ({ streamID, className = '', source = '' }) => {
  return `<video id="${streamID}" src="${source}" class="${className}" autoplay="true" playsinline="true" preload="auto"></video>`
}

export const destroyAutoplayStream = (streamID) => {
  if (!streamID) return
  const videoElement = document.querySelector('#DEMIO_' + streamID)
  if (!videoElement) return
  videoElement.id = ''
  document.body.append(videoElement)
}

export const createAutoplayStreams = () => {
  const videoElements = Array.from({ length: 4 })
    .map((value, index) => createStreamVideo({
      streamID: 'DEMIO_' + index,
      source: '/sfx/silence.mp4',
      className: 'demio-video-element'
    }))
    .join('')

  document.body.append(document.createRange().createContextualFragment(videoElements))
}