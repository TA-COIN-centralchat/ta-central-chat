import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;
let ffmpegLoadPromise = null;

const getFFmpeg = async () => {
  if (ffmpegInstance?.loaded) {
    return ffmpegInstance;
  }

  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }

  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const baseURL =
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

      await ffmpegInstance.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          'text/javascript',
        ),

        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          'application/wasm',
        ),
      });
    })();
  }

  await ffmpegLoadPromise;

  return ffmpegInstance;
};

export const convertVoiceToOgg = async (
  inputBlob,
) => {
  if (!(inputBlob instanceof Blob)) {
    throw new Error(
      'A valid voice recording is required.',
    );
  }

  const ffmpeg = await getFFmpeg();

  const uniqueId = `${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const inputName = `input_${uniqueId}.webm`;
  const outputName = `voice_${uniqueId}.ogg`;

  try {
    await ffmpeg.writeFile(
      inputName,
      await fetchFile(inputBlob),
    );

    await ffmpeg.exec([
      '-i',
      inputName,
      '-vn',
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-ar',
      '48000',
      '-ac',
      '1',
      '-f',
      'ogg',
      outputName,
    ]);

    const outputData =
      await ffmpeg.readFile(outputName);

    return new Blob(
      [outputData.buffer],
      {
        type: 'audio/ogg',
      },
    );
  } finally {
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors.
    }

    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // Ignore cleanup errors.
    }
  }
};