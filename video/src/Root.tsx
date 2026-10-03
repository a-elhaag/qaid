import { Composition } from 'remotion';
import { Video, totalFrames } from './Video';

export const Root = () => <Composition id="Qaid" component={Video} durationInFrames={totalFrames()} fps={30} width={1280} height={720} />;
