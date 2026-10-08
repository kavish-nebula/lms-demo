/** Props every stage component receives from the player. */
export type StageNav = {
  onPrev?: () => void;
  onComplete: () => void;
  done: boolean;
};

export type StageProps<B> = StageNav & { block: B };
