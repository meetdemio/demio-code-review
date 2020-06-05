import OpenTok from '@opentok/client'

let timer
const subscriberStatsByID = {}
const publisherStatsByID = {}

const getFrameRate = (type, stream) => {
  let frameRate = 0

  return () => {
    setTimeout(() => stream.getStats((error, stats) => {
      if (error) return
      const theStats = type === 'publisher' ? stats[0].stats : stats
      frameRate = theStats.video.frameRate
    }))
    return frameRate
  }
}

const calculateBitRate = (type, track, current, last) => {
  const interval = current.timestamp - last.timestamp
  const bytes = type === 'publisher' ? 'bytesSent' : 'bytesReceived'
  return current[track] && current[track][bytes] && last[track] && last[track][bytes] 
    ? (8 * (current[track][bytes] - last[track][bytes])) / (interval / 1000) 
    : 0
}

const getBitRate = (stream, type, track) => {
  let current = null
  let last = null
  let kbps = 0

  return () => {
    setTimeout(() => stream.getStats((error, stats) => {
      if (error) return kbps
      const theStats = type === 'publisher' ? stats[0].stats : stats

      if (!last) last = theStats
      else {
        last = Object.assign({}, current)
        current = theStats
      }
    
      if (current && last) {
        kbps = Math.round(calculateBitRate(type, track, current, last) / 1000)
      }
    }))
    return kbps
  }
}

const getStreamStats = ({ stream, type, statsByID }) => {
  const stats = statsByID[stream.streamId]

  if (!stats) {
    statsByID[stream.streamId] = {
      getVideoBitRate: getBitRate(stream, type, 'video'),
      getAudioBitRate: getBitRate(stream, type, 'audio'),
      getVideoFrameRate: getFrameRate(type, stream),
      loading: true
    }

    return statsByID[stream.streamId] 
  }

  const { getAudioBitRate, getVideoBitRate, getVideoFrameRate } = stats
  stats.audioBitRate = getAudioBitRate()
  stats.videoBitRate = getVideoBitRate()
  stats.videoFrameRate = getVideoFrameRate()
  stats.loading = !(stats.videoBitRate || stats.audioBitRate)

  return stats
}

const startStats = () => {
  if (!timer) {
    const { publishers, subscribers } = OpenTok

    timer = setInterval(() => {
      publishers.where()
        .forEach((stream) => getStreamStats({ 
          stream,
          type: 'publisher',
          statsByID: publisherStatsByID
        }))
      subscribers.where()
        .forEach((stream) => getStreamStats({ 
          stream,
          type: 'subscriber', 
          statsByID: subscriberStatsByID
        }))
    }, 1000)
  }
}

export const stopStats = () => clearInterval(timer)

export const getStats = (streamId) => {
  startStats()
  
  return {
    subscriber: subscriberStatsByID[streamId] || {},
    publisher: publisherStatsByID[streamId] || {},
  }
}

