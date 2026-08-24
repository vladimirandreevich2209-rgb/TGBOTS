import { PagesFunction, Env } from '../../types';

export const onRequestGet: PagesFunction<Env, 'fileName'> = async (context) => {
  // If video is requested, return a sample vertical video stream or redirect
  return Response.redirect(
    'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-neon-lights-in-the-city-41559-large.mp4',
    302
  );
};
