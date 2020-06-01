import OpenTok from '@opentok/client'

let timer
let subscriberStatsByID = {}
let publisherStatsByID = {}

const videoFrameRate = (stream) => {
  let frameRate = 30

  return () => {
    setTimeout(() => stream.getStats((error, stats) => {
      if (error) return
      frameRate = stats.video.frameRate
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
    stream.getStats((error, stats) => {
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
    })
    return kbps
  }
}

const getStreamStats = ({ statsByID, type }) => (stream) => {
  const stats = statsByID[stream.streamId]

  if (!stats) {
    statsByID[stream.streamId] = {
      getVideoBitRate: getBitRate(stream, type, 'video'),
      getAudioBitRate: getBitRate(stream, type, 'audio'),
      getVideoFrameRate: videoFrameRate(stream),
      loading: true
    }
  } else {
    const { getAudioBitRate, getVideoBitRate, getVideoFrameRate } = stats
    stats.audioBitRate = getAudioBitRate()
    stats.videoBitRate = getVideoBitRate()
    stats.videoFrameRate = getVideoFrameRate()
    stats.loading = !(stats.videoBitRate || stats.audioBitRate)
  } 
}

export const getStats = (streamId) => {
  if (!timer) {
    timer = setInterval(() => {
      OpenTok.publishers.where().forEach(getStreamStats({ 
        type: 'publisher',
        statsByID: publisherStatsByID
      }))
      OpenTok.subscribers.where().forEach(getStreamStats({ 
        type: 'subscriber', 
        statsByID: subscriberStatsByID, 
      }))
    }, 1000)
  }
  
  return {
    subscriber: subscriberStatsByID[streamId] || {},
    publisher: publisherStatsByID[streamId] || {},
  }
}

export const stopStats = () => clearInterval(timer)
