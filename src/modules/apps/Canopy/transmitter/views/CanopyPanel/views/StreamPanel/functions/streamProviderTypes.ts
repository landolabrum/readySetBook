export const streamProviderSettings = {

    twitch: {
        video: {
            width: 1920,
            height: 1080,
            colorDepth: 24,
            framerate: 30,
            bitrate: 6000,
        },
        audio: {
            bitrate: 160,
            channels: 2,
            samplerate: 44100,
            inputFormat: 'pulse',
            inputDevice: 'default',
        },
        network: {
            destinationUrl: 'rtmp://live.twitch.tv/app',
            protocol: 'RTMP',
        }
    },
    youtube: {
        video: {
            width: 1920,
            height: 1080,
            colorDepth: 24,
            framerate: 30,
            bitrate: 6000,
        },
        audio: {
            bitrate: 160,
            channels: 2,
            samplerate: 44100,
            inputFormat: 'pulse',
            inputDevice: 'default',
        },
        network: {
            destinationUrl: 'rtmp://a.rtmp.youtube.com/live2',
            protocol: 'RTMP',
        }
    },
    facebook: {
        video: {
            width: 1280,
            height: 720,
            colorDepth: 24,
            framerate: 30,
            bitrate: 5000,
        },
        audio: {
            bitrate: 160,
            channels: 2,
            samplerate: 44100,
            inputFormat: 'pulse',
            inputDevice: 'default',
        },
        network: {
            destinationUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
            protocol: 'RTMPS',
        }
    },
    custom: {
        video: {
            width: 1920,
            height: 1080,
            colorDepth: 24,
            framerate: 30,
            bitrate: 6000,
        },
        audio: {
            bitrate: 160,
            channels: 2,
            samplerate: 44100,
            inputFormat: 'pulse',
            inputDevice: 'default',
        },
        network: {
            destinationUrl: null,
            protocol: 'RTMP',
        }
    },
}
