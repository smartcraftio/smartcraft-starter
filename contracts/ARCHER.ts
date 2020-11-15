import { ContractBase } from "../scapi/ContractBase.ts";
import { SCWorkerRuntime } from "../scapi/SCWorkerRuntime.ts";
import * as scio from "../scapi/scioTypes.ts";

// This file is written to be readable to someone who has programming experience
// but not necessarily TypeScript experience.

const EPSILON = 0.1;
const isCentered = (dim: number): boolean =>
  Math.abs(Math.round(dim) - 0.5 - dim) < EPSILON;
const isOver = (dim: number): boolean => dim - Math.floor(dim) > 0.5;

interface ITargetOffset {
  y: number;
  x: number;
}

function calculateArrowRelative(
  arrowLoc: scio.MinecraftLocation,
  alignedTargetLoc: scio.MinecraftLocation,
): ITargetOffset {
  const y = alignedTargetLoc.y - arrowLoc.y;
  // find
  const useXAxis = isCentered(alignedTargetLoc.x);
  const x = useXAxis
    ? (alignedTargetLoc.x - arrowLoc.x)
    : (alignedTargetLoc.z - arrowLoc.z);
  // check direction we shot from and flip if necessary
  const isFlip = useXAxis ? !isOver(arrowLoc.z) : isOver(arrowLoc.x);
  return { y, x: isFlip ? -x : x };
}

const offsetToDescriptor = (offset: ITargetOffset): string => {
  const rot = ((Math.atan2(offset.y, offset.x) * 180 / Math.PI) + 360 + 90) %
    360;

  if (rot < 22.5) return "high";
  else if (rot < 45 + 22.5) return "high-right";
  else if (rot < 90 + 22.5) return "right";
  else if (rot < 135 + 22.5) return "low-right";
  else if (rot < 180 + 22.5) return "low";
  else if (rot < 225 + 22.5) return "low-left";
  else if (rot < 270 + 22.5) return "left";
  else if (rot < 315 + 22.5) return "high-left";
  return "high";
};

/**
 * CHANGE ME! Provide some good typings for your state.
 */
type Course = {
  courseId: number;
  // There should be 12 targets per finalized course
  targets: scio.MinecraftLocation[];
};

type PlayerPlayingState = {
  action: `PLAYING`;
  courseId: number;
  scores: number[];
};
type PlayerState =
  | {
    action: `CREATING`;
    courseId: number;
  }
  | PlayerPlayingState;
type ClosestResult = {
  location: scio.MinecraftLocation;
  distance: number;
  course: Course;
  targetIndex: number;
};

interface ContractState {
  playerStates: {
    // If player is neither playing nor creating, the player will not have an
    // entry here.
    [uniqueId: string]: PlayerState;
  };
  // Course ID is the index in the array of courses.
  courses: Course[];
}

// Using local variables like this is dangerous, but this is your own foot to
// shoot if you choose to do this. Note: local variables not be persisted, and
// could randomly disappear
let firstArrowSeen = false;

/**
 * The archery minigame.
 */
class Contract extends ContractBase {
  // Set an initial state to extend, in case there was no initial state saved
  state: ContractState = {
    playerStates: {},
    courses: [
      {
        courseId: 0,
        targets: [
          {
            world: `OVERWORLD`,
            x: -1263,
            y: 86.5,
            z: -1275.5,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1259,
            y: 88.5,
            z: -1310.5,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1262.5,
            y: 77.5,
            z: -1367,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1286.5,
            y: 84.5,
            z: -1362,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1321,
            y: 80.5,
            z: -1334.5,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1305.5,
            y: 76.5,
            z: -1290,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1282,
            y: 80.5,
            z: -1289.5,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1288.5,
            y: 75.5,
            z: -1257,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1318,
            y: 74.5,
            z: -1246.5,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1303.5,
            y: 81.5,
            z: -1211,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1270.5,
            y: 76.5,
            z: -1208,
            yaw: 0,
            pitch: 0,
          },
          {
            world: `OVERWORLD`,
            x: -1226,
            y: 73.5,
            z: -1228.5,
            yaw: 0,
            pitch: 0,
          },
        ],
      },
    ],
  };

  constructor(init: scio.ContractInitialization) {
    super(init);
    Object.assign(this.state, init.state);
  }

  publicGetState(): ContractState {
    return this.state;
  }

  /**
   * Initializes a new course
   * @returns new course id
   *
   * Prefixing with an underscore is a stylistic choice to distinguish between
   * functions inherited from ContractBase and contract-specific functions
   */
  _createNewCourse(): number {
    const newCourseId = this.state.courses.length;
    this.state.courses[newCourseId] = {
      courseId: newCourseId,
      targets: [],
    };
    return newCourseId;
  }

  /**
   * Takes in a scio.MinecraftPlayer for more safety.
   * @returns new course id
   *
   * Prefixing with an underscore is a stylistic choice to distinguish between
   * functions inherited from ContractBase and contract-specific functions
   */
  _setPlayerCreating(player: scio.MinecraftPlayer, courseId: number) {
    this.state.playerStates[player.uniqueId] = {
      action: `CREATING`,
      courseId,
    };
    this.api.broadcast(
      `You are now editing course #${courseId}. Shoot an arrow into the gold to register a new target.`,
    );
  }

  onMinecraftPlayerChatCommandEvent(
    event: scio.MinecraftPlayerChatCommandEvent,
  ) {
    if (event.commandArgs[0] == `debug`) {
      this.api.setBlockGlowing(event.player.uniqueId, event.player.location);

      this.api.broadcast(JSON.stringify(this.state, null, 2));
    } else if (event.commandArgs[0] == `help`) {
      this.api.broadcast(`Instructions for building a course`);
      this.api.broadcast(`  1. Build a rail system for the course.`);
      this.api.broadcast(`  2. Build 12 target by placing down blocks.`);
      this.api.broadcast(
        `  3. Get into edit mode, use command: /sc ARCHER new`,
      );
      this.api.broadcast(`  4. Hold some arrows in your inventory.`);
      this.api.broadcast(`  5. Hold a bow in your hand.`);
      this.api.broadcast(
        `  6. Go to the first target in the course to register the target.`,
      );
      this.api.broadcast(
        `  7. Hold right click to draw bow, and then shoot into the bullseye.`,
      );
      this.api.broadcast(
        `  8. Continue for the rest of the targets in the sequence.`,
      );
      this.api.broadcast(`To play a course, simply shoot the first target.`);
      this.api.broadcast(`To scroll up in chat, press: t`);
    } else if (event.commandArgs[0] == `list`) {
      const results = [];
      for (const [courseId, course] of this.state.courses.entries()) {
        results.push(`#${courseId}: ${course.targets.length} targets`);
      }
      const broadcastEffect: scio.MinecraftBroadcastEffect = {
        type: `MinecraftBroadcastEffect`,
        message: results.join(`\n`),
      };
      this.api.broadcast(results.join(`\n`));
    } else if (event.commandArgs[0] == `stop`) {
      const playerState = this._getPlayerState(event.player);
      if (playerState == null) {
        return this.api.broadcast(`You are not playing or editing a course.`);
      }
      if (playerState.action === `CREATING`) {
        delete this.state.playerStates[event.player.uniqueId];
        this.api.broadcast(
          `You have stopped editing course #${playerState.courseId}.`,
        );
        this.api.broadcast(
          `To go back to editing, use command: /sc ARCHER edit ${playerState.courseId}.`,
        );
        this.api.broadcast(
          `To play the course, simply shoot the first target.`,
        );
        return;
      }
      if (playerState.action === `PLAYING`) {
        delete this.state.playerStates[event.player.uniqueId];
        return this.api.broadcast(
          `You have stopped playing course #${playerState.courseId}`,
        );
      }
      const neverReachHere: never = playerState;
    } else if (event.commandArgs[0] == `new`) {
      const courseId = this._createNewCourse();

      this.api.broadcast(`Created new archery course #${courseId}`);
      this.api.broadcast(
        `You are now in edit mode. To exit, use command: /sc ARCHER stop`,
      );
      this.api.broadcast(`Instructions for building a course`);
      this.api.broadcast(`  1. Build a rail system for the course.`);
      this.api.broadcast(`  2. Build 12 target by placing down blocks.`);
      this.api.broadcast(`  3. Get into edit mode (you are already in here).`);
      this.api.broadcast(`  4. Hold some arrows in your inventory.`);
      this.api.broadcast(`  5. Hold a bow in your hand.`);
      this.api.broadcast(
        `  6. Go to the first target in the course to register the target.`,
      );
      this.api.broadcast(
        `  7. Hold right click to draw bow, and then shoot into the bullseye.`,
      );
      this.api.broadcast(
        `  8. Continue for the rest of the targets in the sequence.`,
      );
      this.api.broadcast(
        `To see the help message again, use command: /sc ARCHER help`,
      );
      this.api.broadcast(`To scroll up in chat, press: t`);

      this._setPlayerCreating(event.player, courseId);
    } else if (event.commandArgs[0] == `undo`) {
      const course = this._getPlayerCreationContext(event.player);

      if (course == null) {
        this.api.broadcast(`You are currently not in edit mode.`);
        this.api.broadcast(
          `To create a new course, use command: /sc ARCHER new`,
        );
        return;
      }

      if (course.targets.length < 0) {
        return this.api.broadcast(`Course ${course.courseId} has no targets.`);
      }

      course.targets.pop();
      return this.api.broadcast(
        `Removed last target. Course #${course.courseId} now has ${course.targets.length}/12 targets.`,
      );
    } else if (event.commandArgs[0] == `edit`) {
      try {
        const courseId = parseInt(event.commandArgs[1]);
        const course = this.state.courses[courseId];
        if (!course) {
          this.api.broadcast(`Couldn't find course #${courseId}.`);
          this.api.broadcast(
            `To create a new course, use command: /sc ARCHER new`,
          );
        }
        this._setPlayerCreating(event.player, courseId);

        course.targets.pop();
        return this.api.broadcast(
          `Removed last target. Course #${course.courseId} now has ${course.targets.length}/12 targets.`,
        );
      } catch (e) {
        this.api.broadcast(
          `Unable to find course number ${event.commandArgs[0]}.`,
        );
        this.api.broadcast(
          `To edit an existing course, use command: /sc ARCHER edit <number>`,
        );
      }
    } else if (event.commandArgs[0] == `delete`) {
      const course = this._getPlayerCreationContext(event.player);

      if (course == null) {
        this.api.broadcast(`You are currently not in edit mode.`);
        this.api.broadcast(
          `To create a new course, use command: /sc ARCHER new`,
        );
        this.api.broadcast(
          `To edit an existing course, use command: /sc ARCHER edit <number>`,
        );
        return;
      }

      if (course.targets.length < 0) {
        return this.api.broadcast(`Course ${course.courseId} has no targets.`);
      }

      course.targets.pop();
      return this.api.broadcast(
        `Removed last target. Course ${course.courseId} now has ${course.targets.length}/12 targets.`,
      );
    }
  }

  /**
   * During creation, a player is instructed to shoot the bullseye. If done
   * correctly, the locations will look something like:
   *   x:-1262.96,
   *   y:86.51,
   *   z:-1275.42,
   *
   * This would mean that the target face plane has a normal vector along the
   * X axis. After alignment, the new location would become:
   *   x:-1263,
   *   y:86.5,
   *   z:-1275.5,
   *
   * To align to 0.5, the location must be in the range of (.1, .9)
   * To align to 0.0, the location must be in the range of [.0, .1] or [.9, 1.0]
   *
   * @param location
   */
  _alignCreationShotLocation(
    location: scio.MinecraftLocation,
  ): scio.MinecraftLocation | null {
    // If things go correctly, we should only find one target plane
    let planesDetected = 0;
    const align = (p: number): number => {
      const moduloed = ((p % 1) + 1) % 1;
      // console.log(p, moduloed);
      if (moduloed > 0.1 && moduloed < 0.9) {
        return Math.round(p + 0.5) - 0.5;
      }
      planesDetected++;
      return Math.round(p);
    };

    const newLocation = new scio.MinecraftLocation({
      world: location.world,
      x: align(location.x),
      y: align(location.y),
      z: align(location.z),
      yaw: 0,
      pitch: 0,
    });

    if (planesDetected !== 1) {
      return null;
    }

    return newLocation;
  }

  /**
   * For a course, get the closest target. Return null if course has no target.
   *
   * Returns null if there are no targets in the course.
   */
  _getClosestTarget(
    location: scio.MinecraftLocation,
    course: Course,
  ): {
    closest: scio.MinecraftLocation | null;
    distance: number;
  } {
    let closestLocation: scio.MinecraftLocation | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const targetLocation of course.targets) {
      const targetDistance = scio.MinecraftLocation.distanceBetween(
        location,
        targetLocation,
      );
      if (targetDistance < closestDistance) {
        closestLocation = targetLocation;
        closestDistance = targetDistance;
      }
    }

    return {
      closest: closestLocation,
      distance: closestDistance,
    };
  }

  /**
   * When a player wants to start a course, they simply have to shoot the first
   * target in any course. The smart contract will detect which course the
   * player wants to play.
   *
   * The only way to provide better messaging to the player is to loop through
   * all registered targest globally. On Ethereum, this would guzzle gas, but in
   * Smartcraft, those worries are gone!
   */
  _getClosestGlobally(location: scio.MinecraftLocation): ClosestResult | null {
    let closestLocation: scio.MinecraftLocation | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    let closestCourse = null;
    let closestTargetIndex = -1; // lol js, it doesn't make sense, but it actually does

    for (const course of this.state.courses) {
      course.targets.forEach((target, targetIndex) => {
        const targetDistance = scio.MinecraftLocation.distanceBetween(
          location,
          course.targets[targetIndex],
        );
        if (targetDistance < closestDistance) {
          closestLocation = course.targets[targetIndex];
          closestDistance = targetDistance;
          closestCourse = course;
          closestTargetIndex = targetIndex;
        }
      });
    }

    if (closestCourse === null) return null;
    if (closestLocation == null) return null;

    return {
      location: closestLocation,
      distance: closestDistance,
      course: closestCourse,
      targetIndex: closestTargetIndex,
    };
  }

  _getPlayerState(player: scio.MinecraftPlayer): PlayerState | null {
    return this.state.playerStates[player.uniqueId] ?? null;
  }

  _getPlayerCreationContext(player: scio.MinecraftPlayer): Course | null {
    const playerState = this._getPlayerState(player);
    if (!playerState) return null;
    if (playerState.action !== `CREATING`) return null;

    const course = this.state.courses[playerState.courseId];
    if (course == null) {
      // Invalid course number the player is creating!
      delete this.state.playerStates[playerState.courseId];
      this.api.broadcast(
        `Invalid course #${playerState.courseId}. The course may have been deleted.`,
      );
      return null;
    }
    return course;
  }

  _distanceToScore(posA: number, posB: number): number {
    const delta = Math.abs(posB - posA);
    const lineCut = 1 / 32;
    if (delta < 1 / 16 + lineCut) return 11;
    if (delta < 4 / 16 + lineCut) return 10;
    if (delta < 0.5 + lineCut) return 9;
    if (delta < 1.0 + lineCut) return 8;
    if (delta < 1.5 + lineCut) return 7;
    if (delta < 2.0 + lineCut) return 6;
    if (delta < 2.5 + lineCut) return 5;
    if (delta < 3.0 + lineCut) return 4;
    if (delta < 3.5 + lineCut) return 3;
    if (delta < 4.0 + lineCut) return 2;
    if (delta < 4.5 + lineCut) return 1;
    return 0;
  }

  /**
   * Since targest aren't round, we have to calculate scores in a method that
   * respects the blockiness of our Minecraft targets.
   *
   * We rely on the fact that when we saved target coordinates, one axis
   * coordinate ends in .0 while the other two axes' coordinate ends in .5.
   */
  _calculateBlockyScore(
    arrowLoc: scio.MinecraftLocation,
    alignedTargetLoc: scio.MinecraftLocation,
  ): number {
    let xAligned = arrowLoc.x;
    let yAligned = arrowLoc.y;
    let zAligned = arrowLoc.z;

    if (alignedTargetLoc.x % 1 === 0) {
      xAligned = Math.round(xAligned);
    }
    if (alignedTargetLoc.y % 1 === 0) {
      yAligned = Math.round(yAligned);
    }
    if (alignedTargetLoc.z % 1 === 0) {
      zAligned = Math.round(zAligned);
    }

    const xScore = this._distanceToScore(xAligned, alignedTargetLoc.x);
    const yScore = this._distanceToScore(yAligned, alignedTargetLoc.y);
    const zScore = this._distanceToScore(zAligned, alignedTargetLoc.z);

    return Math.min(xScore, yScore, zScore);
  }

  _scoreToColorCode(score: number): scio.ChatColor {
    if (score <= 2) return scio.ChatColor.WHITE;
    if (score <= 4) return scio.ChatColor.GRAY;
    if (score <= 6) return scio.ChatColor.BLUE;
    if (score <= 8) return scio.ChatColor.RED;
    return scio.ChatColor.GOLD;
  }

  /**
   * Records score and performs scoring actions. Assumes that the targetIndex is
   * already correct.
   */
  _scorePlayerShot(
    playerState: PlayerPlayingState,
    arrowLoc: scio.MinecraftLocation,
    targetIndex: number,
    course: Course,
    targetLoc: scio.MinecraftLocation,
    playerUniqueId: string,
  ) {
    const calculatedScore = this._calculateBlockyScore(arrowLoc, targetLoc);
    // this.api.broadcast(`${arrowLoc.x} ${arrowLoc.y} ${arrowLoc.z}`)

    const offset = calculateArrowRelative(arrowLoc, targetLoc);
    let descriptor = offsetToDescriptor(offset);
    if (calculatedScore <= 0) {
      descriptor = "";
    } else if (calculatedScore >= 11) {
      descriptor = "PERFECT";
    } else if (calculatedScore >= 10) {
      descriptor = "perfect";
    }

    this.api.broadcast(
      `Target #${targetIndex +
        1}/${course.targets.length}. Score: ${calculatedScore.toString()}`,
    );
    this.api.displayTitleOverlay(
      playerUniqueId,
      this._scoreToColorCode(calculatedScore) + calculatedScore.toString(),
      descriptor,
    );
    if (calculatedScore <= 6) {
      this.api.playSound(playerUniqueId, `blueprint:fx.itemgetC`);
    } else if (calculatedScore <= 8) {
      this.api.playSound(playerUniqueId, `blueprint:fx.itemgetB`);
    } else {
      this.api.playSound(playerUniqueId, `blueprint:fx.itemgetA`);
    }
    playerState.scores[targetIndex] = calculatedScore;
    if (targetIndex + 1 >= course.targets.length) {
      if (course.targets.length < 12) {
        this.api.broadcast(
          `You have reached the end of this course. This course is incomplete and only has ${course.targets.length} targets.`,
        );
      }
      const courseScore = playerState.scores.reduce(
        (sum, score) => sum + score,
        0,
      );
      this.api.broadcast(
        `Scoring complete! You scored ${courseScore}/${course.targets.length *
          10}`,
      );
      delete this.state.playerStates[playerUniqueId];
    }
  }

  onMinecraftPlayerArrowLandingEvent(
    event: scio.MinecraftPlayerArrowLandingEvent,
  ) {
    if (!firstArrowSeen) {
      firstArrowSeen = true;
      this.api.broadcast("First arrow shot since contract loaded!");
    }

    const closest = this._getClosestGlobally(event.arrowLocation);
    const playerState = this.state.playerStates[event.playerAtLoose.uniqueId];
    if (!playerState) {
      // Handle the very first shot!
      // Player doesn't have any state
      const closest = this._getClosestGlobally(event.arrowLocation);
      if (closest == null) {
        // This smart contract state has no targets registered.
        // Nothing to do here

        return;
      }
      if (closest == null) return; // Smart contract is fresh
      if (closest.distance > 8) return; // Player can reshoot a terrible shot
      // closest guarantees that if we get a return value, it is in a course with SOMETHING
      if (closest.targetIndex !== 0) {
        this.api.broadcast(
          `Shot target #${closest.targetIndex +
            1}/${closest.course.targets.length} on course #${closest.course.courseId} but not in a scoring session yet.`,
        );
        this.api.broadcast(
          `Shoot the 1st target in this course to start scoring.`,
        );
        return;
      }

      // Player is shooting the first target!
      const newPlayerState: PlayerPlayingState = {
        action: `PLAYING`,
        courseId: closest.course.courseId,
        scores: [],
      };
      this.state.playerStates[event.playerAtLoose.uniqueId] = newPlayerState;

      this._scorePlayerShot(
        newPlayerState,
        event.arrowLocation,
        closest.targetIndex,
        closest.course,
        closest.location,
        event.playerAtLoose.uniqueId,
      );
    } else if (playerState.action === `PLAYING`) {
      if (closest == null) return null; // We wouldn't reach this place ever
      if (closest.distance > 10) return; // Player can reshoot a terrible shot
      // closest guarantees that if we get a return value, it is in a course with SOMETHING
      if (closest.targetIndex < playerState.scores.length) {
        this.api.broadcast(
          `Already shot target #${closest.targetIndex +
            1}/${closest.course.targets.length}! You need to shoot target #${playerState
            .scores.length + 1}/${closest.course.targets.length} instead.`,
        );
        this.api.broadcast(`To stop, use command: /sc ARCHER stop`);
        return;
      }
      if (closest.targetIndex !== playerState.scores.length) {
        this.api.broadcast(
          `You skipped from target #${playerState.scores.length +
            1}/${closest.course.targets.length} to target #${closest
            .targetIndex + 1}/${closest.course.targets.length}.`,
        );
        this.api.broadcast(`To stop, use command: /sc ARCHER stop`);
      }

      this._scorePlayerShot(
        playerState,
        event.arrowLocation,
        closest.targetIndex,
        closest.course,
        closest.location,
        event.playerAtLoose.uniqueId,
      );
    } else if (playerState.action === `CREATING`) {
      const course = this._getPlayerCreationContext(event.playerAtLoose);
      if (course == null) return;

      const newPositionNumber = course.targets.length + 1;

      const closest = this._getClosestGlobally(event.arrowLocation);
      if (closest != null) {
        // If null, then this smart contract is fresh!

        if (closest.distance < 10) {
          if (closest.course.courseId == course.courseId) {
            return this.api.broadcast(
              `This course already has a registered target ${Math.round(
                closest.distance * 10,
              ) / 10} blocks away.`,
            );
          }
          return this.api.broadcast(
            `Another course #${closest.course.courseId} has a registered target ${Math
              .round(closest.distance * 10) / 10} blocks away.`,
          );
        }
        if (course.targets.length >= 12) {
          this.api.broadcast(
            `Course #${playerState.courseId} already has the maximum of 12 targets`,
          );
          this.api.broadcast(`To stop editing, use command: /sc ARCHER stop`);
          return;
        }
      }

      const alignedLoc = this._alignCreationShotLocation(event.arrowLocation);
      if (alignedLoc == null) {
        return this.api.broadcast(
          `Unable to align shot. Shoot closer towards the center.`,
        );
      }

      // The arrow location in front of the block it was hit. However, we want
      // to get the actual target block. We can use the fact that the aligned
      // loc is centered, so we can move the location forward inside. As long as
      // the movement is less than 0.5 blocks, we are guaranteed to stay in the
      // correct block.
      // directionVector = arrowLocation - playerlocation
      // normalize()
      // Multiply by 0.3

      // Use thie glowing effect which outlines a block to show a player where
      // the shot was registered.

      const directionVector = scio.MinecraftLocation.normalize(
        scio.MinecraftLocation.subtract(
          event.arrowLocation,
          event.playerAtLoose.location,
        ),
      );
      const inchingForwardVector = scio.MinecraftLocation.multiply(
        directionVector,
        0.1,
      );

      const blockArrowHit = scio.MinecraftLocation.add(
        event.arrowLocation,
        inchingForwardVector,
      );
      this.api.broadcast(JSON.stringify(directionVector, null, 2));
      this.api.setBlockGlowing(event.playerAtLoose.uniqueId, blockArrowHit);

      course.targets[course.targets.length] = alignedLoc;
      this.api.broadcast(
        `Target location #${newPositionNumber}/12 registered! Now shoot the next one.To undo, use command: /sc ARCHER undo`,
      );
      this.api.broadcast(`To stop editing, use command: /sc ARCHER stop`);
    }
  }

  _test(): void {}
}

new SCWorkerRuntime(Contract, import.meta);
