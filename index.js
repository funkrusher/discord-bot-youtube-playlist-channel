// log all errors to console.
process.on("unhandledRejection", console.error);

// config
const config = require("./botconfig.json");

// youtube-apis
const YouTube = require("discord-youtube-api");
const youtube = new YouTube(config.google_api_key);
const ytdl = require('ytdl-core');

// discord-apis
const Discord = require('discord.js');
const client = new Discord.Client();

// state-variables
var playing = false;
var ytAudioQueue = [];
var videoArray = [];

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

/**
* Stream a given youtube-video as audio into the discord voice-channel.
*/
function streamAudioToChannel(streamUrl) {
    const streamOptions = {seek: 0, volume: 1};
    console.log("Streaming audio from " + streamUrl);
    if (streamUrl) {
        const stream = ytdl(streamUrl, {filter: 'audioonly'});
        const dispatcher = client.voiceConnections.first().playStream(stream, streamOptions);
        dispatcher.on("end", end => {
          // the audio has finished playing,
          // so we remove it from the queue and start playing the next youtube-video.
          console.log('Finished Playing: ${info.title}');
          if (ytAudioQueue.length > 0) {
            // there are still videos in the playlist left,
            // so lets play the next video...
            var popped = ytAudioQueue.pop();
            streamAudioToChannel(popped);

          } else {
            // we have no videos left in the playlist,
            // so lets reinitialize the playlist in random order
            // and start it again.
            restartPlaylist();
          }

        })
        .on("error", error => {
          console.error(error);
          console.log("Error Occurred during playback. Try again later.");
        });
    }
}

/**
* We already have resolved the playlist.
* This function starts playing the playlist in a random order
* into the configured discord-channel.
*/
function restartPlaylist() {
     console.log('restartPlaylist');

     shuffleArray(videoArray);

     ytAudioQueue = [];
     for (var i=0; i < videoArray.length; i++) {
       var videoItem = videoArray[i];
       var link = 'https://www.youtube.com/watch?v=' + videoItem.id;

       console.log('restartPlaylist - addlink: ', link);
       ytAudioQueue.push(link);
     }
     console.log('restartPlaylist - ready: ', ytAudioQueue);

     var popped = ytAudioQueue.pop();
     streamAudioToChannel(popped);
}


client.on('ready', async () => {
  console.log('ready...');

  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    // we are ready, and now we listen for members that join or leave
    // the specific audio-channel that we are watching..

    let newUserChannel = newMember.voiceChannel;
    let oldUserChannel = oldMember.voiceChannel;
    if(newUserChannel !== undefined && newUserChannel.id === config.channel_id) {
       // user joins our voice-channel, lets start playing.
       console.log('event: user joined our voicechannel with id: ', config.channel_id);
       if (!playing) {
         playing = true;

         // join the same channel now with our bot,
         // then resolve the youtube-playlist and start playing it into the channel.
         const channel = client.channels.get(config.channel_id);
         let connection = await channel.join();
         videoArray = await youtube.getPlaylist(config.youtube_playlist);

         restartPlaylist();
       }

    } else {
      // user leaves or moves a voice channel
      console.log('event: user left or moved voicechan');
      if (oldUserChannel) {
        if (oldUserChannel.members.size <= 1 && oldUserChannel.id === config.channel_id) {
          // the last user has left our voice-channel, so we also need to leave now.
          if (oldMember.user.bot == false) {
            console.log('event: all users have left our voicechannel with id: ', config.channel_id);
            playing = false;
            oldUserChannel.leave();
          }
        }
      }
    }
  });
});

// login to the discord-server with the bot-token.
// note: the bot-token must already be authorized to enter the discord-server.
client.login(config.bot_token);
