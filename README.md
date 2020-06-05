# TOKBOX INTEGRATION

The following files are in this repo for a code review to find possible ways to improve the use of the Tokbox JS SDK, the error handling, the general performance, etc.

- TokboxWebsocket
  Handles the websocket connection to our singaling server. We use Tokbox NODE SDK in that server to create the sessions, user tokens, start archiving... 

- TokboxSession
  Handles the Session initilization, connection and attaches the session event listeners after the Tokbox webscket receives the Session ID, apiKey and user token.

- TokboxSessionHelpers
  Contains the event listener callbacks for the Session, Connection and Streams. Also, shares functions for error handling and UI helpers.

- TokboxPublisher
  Handles the publisher initialization, publication of audio and video streams, errors and attaches the publisher event listeners. Subcribes to its own stream for monitoring the stats to provide use notifications about the streaming quaility. Uses our hack for the audio autoplay.

- TokboxScreenPublisher
  Handles the publisher initialization, publication of screen-sharing, errors and attaches the publisher event listeners. Subcribes to its own stream for monitoring the stats to provide use notifications about the streaming quaility. 

- TokboxSubscriber
  Handles the subcriber creation when a stream is created. Attaches an event to listen the audio level updates to animate the user card. Also controls the prefered stream resolution and the framerate restricttion for the layout with small webcams.

- TokboxStreamStats
  Handles the streams stats of publishers and subscribers to know the audio and video bitrate, framerate and package lost (pending).

- audioAutoplay
  Creates silent videos with permissions to autoplay audio because are created right after the user clicks on the button to join the room. Then when a stream is created uses a video with permissions updating the srcObject attribute with the MediaStream from the video created by Tokbox.

We use these files for the integration of Tokbox in Demio Viewer, here join links for testing two presenters:

- https://event.staging.demio.com/join/[demo-hash]
- https://event.staging.demio.com/join/[demo-hash]

The features to grant pemissions to attendees to share their devices is still pending.