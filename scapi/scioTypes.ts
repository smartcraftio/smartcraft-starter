export class LedgerPlayer {
  // Username gets updated every time the user converts or ranks up. simple way of keeping things up to date if player changes username
  username: string; // Username is for display purposes only. uniqueId is stored above the ledgerplayer

  cash: number;

  advancementsCash: number;

  mcmmoLevelCash: number;

  constructor(init: any) {
    this.cash = init.cash ? init.cash : 0;
    this.username = init.username ? init.username : `unknown`;

    // Amount of money earned from advancements and mcmmo. Represented in cash for idempotence
    this.advancementsCash = init.advancementsCash ? init.advancementsCash : 0;
    this.mcmmoLevelCash = init.mcmmoLevelCash ? init.mcmmoLevelCash : 0;
  }
}

export class LedgerPlayers {
  [pid: string]: LedgerPlayer | undefined // Should be uniqueId

  constructor(players: any) {
    for (const pid in players) {
      if (Object.prototype.hasOwnProperty.call(players, pid)) {
        const player = players[pid];

        if (player !== undefined) {
          this[pid] = new LedgerPlayer(player);
        }
      }
    }
  }
}

export const ORG_FOUNDING_COST = 15000;

/**
 * All the colors except for white
 *
 * @internal
 */
export type OrgColor =
  | `AQUA`
  | `BLACK`
  | `BLUE`
  | `DARK_AQUA`
  | `DARK_BLUE`
  | `DARK_GRAY`
  | `DARK_GREEN`
  | `DARK_PURPLE`
  | `DARK_RED`
  | `GOLD`
  | `GRAY`
  | `GREEN`
  | `LIGHT_PURPLE`
  | `RED`
  | `YELLOW`;
/**
 * @internal
 */
export type OrgSymbol = string;
/**
 * @internal
 */
export class OrgMetadata {
  name: string;

  color: OrgColor;

  constructor(init: any) {
    this.name = init.name;
    this.color = init.color;
  }
}

export class LedgerOrg {
  symbol: OrgSymbol; // The oid should NEVER change. So this is some denormalization ... uh wait is that what this word means?

  meta: OrgMetadata; // The state machine doesnt concern itself with meta. For simplicity's sake. If directors want to fuck up their metadata, they are free to.

  directors: string[]; // simple array of player ids

  cash: number; // Amount of cash held inside. Can contain decimals!

  // memory: string  // Smart contract memory. A stringified JSON format. Smart contract data is opaque to consensus

  constructor(init: LedgerOrg) {
    this.symbol = init.symbol ? init.symbol : `MISSINGNO`;
    if (this.symbol === `MISSINGNO`) throw new Error(`Missing organization ID`);
    this.meta = init.meta ? new OrgMetadata(init.meta) : new OrgMetadata({});
    this.directors = init.directors;
    this.cash = init.cash ? init.cash : 0;
    // this.memory = init.memory ? init.memory : '{}'

    // const errors = validateSync(this) // ?
    // if (errors.length) {
    //   errors // ?
    //   throw new Error(JSON.stringify(errors[0].constraints))
    // }
  }
}

export class LedgerOrgs {
  [symbol: string]: LedgerOrg | undefined // oid is ticker. A copy will be inside the LedgerOrg too, for the sake of convenience. Ticker symbol will never change

  constructor(orgs: LedgerOrgs) {
    for (const symbol in orgs) {
      if (Object.prototype.hasOwnProperty.call(orgs, symbol)) {
        const ledgerOrg = orgs[symbol];

        if (ledgerOrg !== undefined) {
          this[symbol] = new LedgerOrg(ledgerOrg);
        }
      }
    }
  }
}
export function keysOfLedgerOrgs(orgs: LedgerOrgs): string[] {
  const result: string[] = [];
  for (const symbol in orgs) {
    if (Object.prototype.hasOwnProperty.call(orgs, symbol)) {
      result.push(symbol);
    }
  }
  return result;
}

// export interface LedgerAssets {
//   [oid: string]: number; // Super simple!
// }

/**
 * @internal
 */
export interface Transaction {
  type: string;
  [key: string]: string;
}

/**
 * @internal
 */
export interface Operations {
  [name: string]: (state: Ledger, tx: any) => void;
}

/**
 * The root of the ledger used in the system's blockchain.
 *
 * This is read-only from the point of view of a smart contract.
 */
export interface Ledger {
  height: number;
  players: LedgerPlayers;
  orgs: LedgerOrgs;
}
export class Ledger {
  height: number;

  players: LedgerPlayers;

  orgs: LedgerOrgs;

  constructor(init: any) {
    this.height = init.height ? init.height : 0;
    this.players = init.players && Object.keys(init.players).length
      ? new LedgerPlayers(init.players)
      : {};
    this.orgs = init.orgs && Object.keys(init.orgs).length
      ? new LedgerOrgs(init.orgs)
      : {};
  }
}

/**
 * @internal
 */
export type JsonValue = string | number | boolean | JsonObject | JsonArray;
/**
 * @internal
 */
export type JsonArray = JsonValue[];

/**
 * A type for any object that can be trivially represented as JSON.
 * A JsonObject must be have a root {} wrapper
 *  - string
 *  - number
 *  - boolean
 *  - array
 *  - recursively nested `JsonObject`s
 *
 * @internal
 */
export interface JsonObject {
  [x: string]: JsonValue;
}

// APIs must use this StateProvider, because this is how state is private
// export class StateProvider {
//   getPrivateState: () => JSONObject

//   publicState: JSONObject

//   constructor(privateState: JSONObject, publicState: JSONObject) {
//     this.getPrivateState = () => privateState
//     this.publicState = publicState
//   }
// }

/**
 * Every time the smart contract is run, it is first initialized with the current
 * state. If you use the official ContractBase, this is handled for you.
 *
 * @internal
 */
export interface ContractInitialization {
  state: JsonObject;
}

// If we don't use this hack, we will need to create a duplicate interface
// https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
// Btw, follow this issue in hopes of TypeScript solving this verbosity issue:
// https://github.com/microsoft/TypeScript/issues/26792
// Uh oh, nevermind. This requires us to pass in full objects, and not just things
// matching interfaces, so we can't initialize everything in one call
// Oh well. We will have to live with verbosity. Verbosity is what we will have
// to live with. And in this verbosity, we will live verbose lives of verbosity.
// The quest for conciseness is a futile journey in futility.
// The quest for conciseness is a futile journey in futility.
// The quest for conciseness is a futile journey in futility.
// type NonFunctionPropertyNames<T> = {
//   [K in keyof T]: T[K] extends Function ? never : K;
// }[keyof T];
// type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;
// Turns out, the verbosity was a dangerous thing, because contracts could assign
// a object to their constructor but then when the state gets rehydrated, turns
// back into a plain object duck typing style.
// And the solution ot this is static members ... omg i am such a noob.

/**
 * Numbers contain up to 2 decimals of precision.
 *
 * @param world Can be either "OVERWORLD", "NETHER", or "END"
 * @param x Floating-point coordinate.
 * ```
 * +X => east
 * -X => west
 * ```
 * @param y Floating-point coordinate.
 * ```
 * +Y => up
 * -Y => down
 * ```
 * @param z Floating-point coordinate.
 * ```
 * +Z => north
 * -Z => south
 * ```
 * @param yaw Degree of true north azimuth in range `[0.0 - 360.0]`.
 * ```
 * 0 yaw => north
 * 90 yaw => west
 * 180 yaw => south
 * 270 yaw => east
 * ```
 * @param pitch Degree of elevation.
 * ```
 * 0 => horizon
 * 90 => downward
 * -90 => upward
 * ```
 */
export interface MinecraftLocation {
  readonly world: "OVERWORLD" | "NETHER" | "END";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
}
export class MinecraftLocation implements MinecraftLocation {
  constructor(init: MinecraftLocation) {
    Object.assign(this, init);
  }

  /**
   * Straight-line distance (meters) between two locations. 1 block = 1 meter.
   *
   * Usage example:
   * ```ts
   * let blocksFromAtoB = scio.MinecraftLocation.distanceBetween(
   *    locationA,
   *    locationB,
   *  );
   * ```
   */
  static distanceBetween(
    locationA: MinecraftLocation,
    locationB: MinecraftLocation,
  ): number {
    const xDelta = locationA.x - locationB.x;
    const yDelta = locationA.y - locationB.y;
    const zDelta = locationA.z - locationB.z;
    return Math.sqrt(xDelta * xDelta + yDelta * yDelta + zDelta * zDelta);
  }

  /**
   * Length (meters) of a vector. 1 block = 1 meter.
   *
   * Vectors are represented as MinecraftLocation. Pitch and yaw are ignored.
   *
   * Usage example:
   * ```ts
   * let metersLength = scio.MinecraftLocation.vectorLength(someLocation);
   * ```
   */
  static vectorLength(vector: MinecraftLocation): number {
    return Math.sqrt(
      vector.x * vector.x + vector.y * vector.y + vector.z * vector.z,
    );
  }

  /**
   * Returns normalized vector. The length of the normalized vector will be
   * exactly 1 meter.
   *
   * Vectors are represented as MinecraftLocation. Pitch and yaw are ignored.
   *
   * Usage example:
   * ```ts
   * let unitVector = scio.MinecraftLocation.normalize(someMinecraftLocation);
   * ```
   */
  static normalize(vector: MinecraftLocation): MinecraftLocation {
    let length = this.vectorLength(vector);
    if (length === 0) {
      throw new Error("Vector passed to normalize was of length 0");
    }
    return {
      world: vector.world,
      x: vector.x / length,
      y: vector.y / length,
      z: vector.z / length,
      yaw: vector.yaw,
      pitch: vector.pitch,
    };
  }

  /**
   * Subtract locationTo from locationFrom. Turns into a vector.
   *
   * Vectors are represented as MinecraftLocation. Yaw and pitch will be set to
   * -1, indicating that this is a vector.
   *
   * NOTE: The ordering of to and from is important. Subtraction is not
   * commutative.
   *
   * @param locationTo The location of the head of the vector
   *
   * @param locationFrom The location of the tail of the vector
   *
   * Usage example:
   * ```ts
   * let directionSensitiveVector = scio.MinecraftLocation.subtract(
   *   someMinecraftLocationHead,
   *   someMinecraftLocationTail,
   * );
   * ```
   */
  static subtract(
    locationTo: MinecraftLocation,
    locationFrom: MinecraftLocation,
  ): MinecraftLocation {
    return {
      world: locationTo.world,
      x: locationTo.x - locationFrom.x,
      y: locationTo.y - locationFrom.y,
      z: locationTo.z - locationFrom.z,
      yaw: -1,
      pitch: -1,
    };
  }

  /**
   * Multiplies a vector (MinecraftLocation) by a scalar (number).
   *
   * Result is a vector. Vectors are represented as MinecraftLocation.
   *
   * Usage example:
   * ```ts
   * let resultVector = scio.MinecraftLocation.multiply(
   *   someMinecraftLocation,
   *   12.345,
   * );
   */
  static multiply(
    location: MinecraftLocation,
    scalar: number,
  ): MinecraftLocation {
    return {
      world: location.world,
      x: location.x * scalar,
      y: location.y * scalar,
      z: location.z * scalar,
      yaw: -1,
      pitch: -1,
    };
  }

  /**
   * Add a vector to a location. Yaw and Pitch of the first argument will be
   * kept.
   *
   * Vectors are represented as MinecraftLocation.
   *
   * @param A Location/vector to add
   * @param B Location/vector to add
   *
   * Usage example:
   * ```ts
   * let resultLocation = scio.MinecraftLocation.add(
   *   someMinecraftLocation,
   *   someVector,
   * );
   */
  static add(A: MinecraftLocation, B: MinecraftLocation): MinecraftLocation {
    return {
      world: A.world,
      x: A.x + B.x,
      y: A.y + B.y,
      z: A.z + B.z,
      yaw: A.yaw,
      pitch: A.pitch,
    };
  }
}
export const MockMinecraftLocation: MinecraftLocation = {
  world: "OVERWORLD",
  x: 10.14,
  y: 64.52,
  z: -10.35,
  yaw: 30,
  pitch: 12,
};

// /**
//  * - **blockX,blockY,blockZ**: Integer location of the block. To convert from a
//  * precise location to a block coordinate, round towards negative infinity
//  *
//  * Numbers contain 0 decimals of precision because they are integers
//  *
//  */
// export interface MinecraftBlock {
//   world: "OVERWORLD" | "NETHER" | "END";
//   blockX: number;
//   blockY: number;
//   blockZ: number;
// }

/**
 * Don't use username as a key, since Mojang allows players to change usernames.
 * Instead, use the uuid and retrieve the username using it.
 *
 * @param uniqueId UUID of a player assigned by Mojang that never changes
 * @param speed Player's instantaneous speed in meters/second
 * @param transportMode Player's mode of transportation.
 */
export interface MinecraftPlayer {
  uniqueId: string;
  location: MinecraftLocation;
  speed: number;
  transportMode:
    | "WALKING_SPRINTING"
    | "RIDING_MINECART"
    | "RIDING_ANIMAL"
    | "RIDING_BOAT"
    | "SWIMMING"
    | "FLYING_ELYTRA";
}
/**
 * @param commandArgs An array of arguments from the player, split by spaces.
 * Arguments are case sensitive. For example, if a player runs the command
 * `/smartcontract TICKER argument 123`, this will be `["argument",
 * "123"]`
 */
export type MinecraftPlayerChatCommandEvent = {
  type: "MinecraftPlayerChatCommandEvent";
  player: MinecraftPlayer;
  commandArgs: string[];
};
/**
 * A mock example useful for unit testing. To make a derivative of a mock, use
 * ```js
 * Object.assign({}, scio.MockMinecraftPlayerChatCommandEvent, {
 *  key: "value", //etc
 * })
 * ```
 */
export const MockMinecraftPlayerChatCommandEvent:
  MinecraftPlayerChatCommandEvent = {
    type: "MinecraftPlayerChatCommandEvent",
    player: {
      uniqueId: "3c052e6e-96c1-4232-95dc-fcc4ed7b9d03",
      location: {
        world: "OVERWORLD",
        x: 10.14,
        y: 64.52,
        z: -10.35,
        yaw: 30,
        pitch: 12,
      },
      speed: 5.32,
      transportMode: "WALKING_SPRINTING",
    },
    commandArgs: ["argument", "123"],
  };
/**
 * @param signLocation The location of the sign that was clicked
 * @param commandArgs An array of arguments from the player, split by spaces.
 * Arguments are case sensitive. For example, if a player runs the command
 * `/smartcontract TICKER argument 123`, this will be `["argument",
 * "123"]`
 */
export type MinecraftPlayerSignCommandEvent = {
  type: "MinecraftPlayerSignCommandEvent";
  player: MinecraftPlayer;
  signLocation: MinecraftLocation;
  commandArgs: string[];
};
/**
 * A mock example useful for unit testing. To make a derivative of a mock, use
 * ```js
 * Object.assign({}, scio.MockMinecraftPlayerSignCommandEvent, {
 *  key: "value", //etc
 * })
 * ```
 */
export const MockMinecraftPlayerSignCommandEvent:
  MinecraftPlayerSignCommandEvent = {
    type: "MinecraftPlayerSignCommandEvent",
    player: {
      uniqueId: "3c052e6e-96c1-4232-95dc-fcc4ed7b9d03",
      location: {
        world: "OVERWORLD",
        x: 10.1,
        y: 64.52,
        z: -10.35,
        yaw: 30,
        pitch: 12,
      },
      speed: 5.32,
      transportMode: "WALKING_SPRINTING",
    },
    signLocation: {
      world: "OVERWORLD",
      x: 12.1,
      y: 64,
      z: -10.8,
      yaw: 0,
      pitch: 0,
    },
    commandArgs: ["argument", "123"],
  };
/**
 * @param player The player's location at the time of joining the server. May be
 * outdated by a few seconds.
 */
export type MinecraftPlayerJoinEvent = {
  type: "MinecraftPlayerJoinEvent";
  player: MinecraftPlayer;
};
/**
 * A mock example useful for unit testing. To make a derivative of a mock, use
 * ```js
 * Object.assign({}, scio.MockMinecraftPlayerJoinEvent, {
 *  key: "value", //etc
 * })
 * ```
 */
export const MockMinecraftPlayerJoinEvent: MinecraftPlayerJoinEvent = {
  type: "MinecraftPlayerJoinEvent",
  player: {
    uniqueId: "3c052e6e-96c1-4232-95dc-fcc4ed7b9d03",
    location: {
      world: "OVERWORLD",
      x: 10.1,
      y: 64.52,
      z: -10.35,
      yaw: 30,
      pitch: 12,
    },
    speed: 0,
    transportMode: "WALKING_SPRINTING",
  },
};
/**
 * @param playerAtLoose A snapshot of past info about a player at the moment
 * when the player shot (aka loosed) the arrow
 * @param arrowLocation Location of the intersection between the arrow and where
 * the arrow hit. Location is detailed enough for archery mini-games
 * @param lineOfSightFlyDistance Distance from where player shot the arrow to
 * the landing location of the arrow, represented in meters. A convenience value
 * directly derived from calculating distance between playerAtLoose and
 * arrowLocation
 */
export type MinecraftPlayerArrowLandingEvent = {
  type: "MinecraftPlayerArrowLandingEvent";
  playerAtLoose: MinecraftPlayer;
  arrowLocation: MinecraftLocation;
  lineOfSightFlyDistance: number;
};
/**
 * A mock example useful for unit testing. To make a derivative of a mock, use
 * ```js
 * Object.assign({}, scio.MockMinecraftPlayerArrowLandingEvent, {
 *  key: "value", //etc
 * })
 * ```
 */
export const MockMinecraftPlayerArrowLandingEvent:
  MinecraftPlayerArrowLandingEvent = {
    type: "MinecraftPlayerArrowLandingEvent",
    playerAtLoose: {
      uniqueId: "3c052e6e-96c1-4232-95dc-fcc4ed7b9d03",
      location: {
        world: "OVERWORLD",
        x: -1304.5,
        y: 70.71,
        z: -1232.96,
        yaw: 177.56,
        pitch: -25.55,
      },
      speed: 9.9,
      transportMode: "RIDING_MINECART",
    },
    arrowLocation: {
      world: "OVERWORLD",
      x: -1303.52,
      y: 81.31,
      z: -1211.05,
      yaw: 181.16,
      pitch: 10.63,
    },
    lineOfSightFlyDistance: 24.36,
  };
/**
 * Event triggered when player moves for any reason. Player's transport mode is
 * found at player.transportMode
 *
 * While minecraft ticks at 20 times per second, this event is only triggered up
 * to 10 times per second to reduce the total load on the system.
 *
 * If you wish to track at a higher resolution time, create a system where the
 * player is free falling past a ring. Then, you can create an offset of up to
 * 100 milliseconds calculated from how far they made it past the ring when the
 * event was triggered.
 *
 * @param player MinecraftPlayer object, which contains many goodies.
 * @param previousLocation The previous location of the player. Guaranteed to
 * be different from player.location by at least 0.001 blocks
 */
export type MinecraftPlayerMoveEvent = {
  type: "MinecraftPlayerMoveEvent";
  /** MinecraftPlayer object, which contains many goodies. */
  player: MinecraftPlayer;
  previousLocation: MinecraftLocation;
};
/**
 * Will be called one time, for when Hytale is supported. Smart contracts can
 * listen to this event to then send a notification of some sort.
 *
 * @easteregg
 * @hytale
 * @internal
 */
export type HytaleLaunchEvent = {
  type: `HytaleLaunchEvent`;
  year: 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | 2027 | 2028 | 2029 | 2030;
};
/**
 * Sorry Roblox
 *
 * @roblox
 * @internal
 */
export type RobloxSupportedEvent = {
  type: `RobloxSupportedEvent`;
  year: `never`;
};

/**
 * Events are passed from the server to the smart contract.
 */
export type Event =
  | MinecraftPlayerChatCommandEvent
  | MinecraftPlayerSignCommandEvent
  | MinecraftPlayerJoinEvent
  | MinecraftPlayerArrowLandingEvent
  | MinecraftPlayerMoveEvent
  | HytaleLaunchEvent
  | RobloxSupportedEvent;

// export function GenericEventToSpecificEvent(event: Event): Event {
//   if (event === undefined) {
//     throw new Error("Event is undefined!! " + JSON.stringify(event, null, 2));
//   }
//   if (event.type === undefined) {
//     throw new Error("Event.type is undefined! " + JSON.stringify(event, null, 2));
//   }
//   const eventType = event.type; // TypeScript is too smart to use this in the error message

//   // Use TypeScript's static analysis!
//   if (event.type == "MinecraftPlayerChatCommandEvent") {
//     return new MinecraftPlayerChatCommandEvent(event);
//   } else if (event.type == "MinecraftPlayerSignCommandEvent") {
//     return new MinecraftPlayerSignCommandEvent(event);
//   } else if (event.type == "MinecraftPlayerJoinEvent") {
//     return new MinecraftPlayerJoinEvent(event);
//   } else if (event.type == "MinecraftPlayerArrowLandingEvent") {
//     return new MinecraftPlayerArrowLandingEvent(event);
//   } else if (event.type == "HytaleLaunchEvent") {
//     return new HytaleLaunchEvent(event);
//   } else if (event.type == "RobloxSupportedEvent") {
//     return new RobloxSupportedEvent(event);
//   } else {
//     const ifErroredThenNotAllCasesCovered: never = event;
//     throw new Error(`Unknown event type ${eventType}`);
//   }
// }

/**
 * @internal
 */
export interface MinecraftBroadcastEffect {
  type: `MinecraftBroadcastEffect`;
  message: string;
}

/**
 * @internal
 */
export interface MinecraftTitleEffect {
  type: `MinecraftTitleEffect`;
  playerUniqueId: string;
  title: string;
  subtitle: string;
}

/**
 * @internal
 */
export interface MinecraftBlockGlowEffect {
  type: `MinecraftBlockGlowEffect`;
  playerUniqueId: string;
  x: number;
  y: number;
  z: number;
  ticks: number;
}

/**
 * @internal
 */
export interface MinecraftPlaySoundEffect {
  type: `MinecraftPlaySoundEffect`;
  playerUniqueId: string;
  soundName: string;
}

/**
 * An effect emitted by the SC Worker runtime to ignore events to reduce CPU
 * usage. In theory, the ignoring drops the events before the process is even
 * sent to the smart contract process, so the smart contract won't be billed for
 * the CPU usage.
 *
 * @internal
 * @todo
 */
export interface VMIgnoreEventEffect {
  type: `VMIgnoreEventEffect`;
  eventType: string;
}

/**
 * Effects prefixed with Minecraft will be passed into the Minecraft server
 * for further processing.
 *
 * @internal
 */
export type Effect =
  | MinecraftBroadcastEffect
  | MinecraftTitleEffect
  | MinecraftBlockGlowEffect
  | MinecraftPlaySoundEffect
  | VMIgnoreEventEffect;

/**
 * @internal
 */
export interface ContractResult {
  effects: Effect[];
}

/**
 * @internal
 */
export interface ContractWorkerMessage {
  nop?: boolean; // Use nop=true if it is a no op
  state?: any; // If state is undefined, don't transition state
  result: ContractResult;
}

export class API {
  // contractInstance should be a ContractBase, but we use any because we can't
  // import any files in scioTypes.ts to preserve cross platform compatibility
  // on both node, deno, and done
  private contractInstance: any;

  constructor(init: ContractInitialization, contractInstance: any) {
    this.contractInstance = contractInstance;
    if (!Array.isArray(contractInstance.effects)) {
      throw new Error(
        "scio.API expects to get a contract instance, or at least something with .effects[]",
      );
    }
  }

  /**
   * Broadcast a message to all players. This function will be removed when the
   * smart contract system hits production since the potential for abuse is too
   * big.
   *
   * @param message The message to be sent. Minecraft-style codes are allowed.
   * See `scio.ChatColor` for basic color codes.
   *
   * @effect This function will add an item to the contract's `this.effects`
   */
  broadcast(message: string) {
    const broadcastEffect: MinecraftBroadcastEffect = {
      type: "MinecraftBroadcastEffect",
      message: message,
    };
    this.contractInstance.effects.push(broadcastEffect);
  }

  /**
   * Displays huge text on the middle of a player's screen.
   *
   * A field can be left empty by using the empty string `""`.
   *
   * Newlines don't work (the client will ignore all text after a newline).
   *
   * @param playerUniqueId UUID of the player to display title to
   * @param subtitle Medium text centered just below the cursor. Less
   * intrusive and can support more text.
   * @param title Large text centered just above the cursor, potentially covering
   * the player's view. Keep this under 30 characters.
   *
   * @effect This function will add an item to the contract's this.effects
   */
  displayTitleOverlay(
    playerUniqueId: string,
    title: string = "",
    subtitle: string = "",
  ) {
    if (playerUniqueId.length < 32 || playerUniqueId.length > 36) {
      throw new Error(`Invalid playerUniqueId. Got: ${playerUniqueId}`);
    }
    const effect: MinecraftTitleEffect = {
      type: "MinecraftTitleEffect",
      playerUniqueId: playerUniqueId,
      title: title,
      subtitle: subtitle,
    };
    this.contractInstance.effects.push(effect);
  }

  /**
   * Adds a hologram glow around an existing block for 2 seconds. Only works on
   * solid blocks that fill up the whole 1x1x1 cube. This glow effect can be
   * seen through walls.
   *
   * @param player UUID of the player to display this hologram to
   * @param location A location that describes a point inside the block
   * @param ticks Number of ticks to display the block. 1 tick = 0.05 seconds.
   * Maximum of 80 ticks (4 seconds)
   *
   * @effect This function will add an item to the contract's this.effects
   */
  setBlockGlowing(
    uniqueId: string,
    location: MinecraftLocation,
    ticks: number = 80,
  ) {
    const effect: MinecraftBlockGlowEffect = {
      type: "MinecraftBlockGlowEffect",
      playerUniqueId: uniqueId,
      x: location.x,
      y: location.y,
      z: location.z,
      ticks: ticks,
    };
    this.contractInstance.effects.push(effect);
  }

  /**
   * Plays a sound to a specific player. Sound is rendered non-directionally.
   *
   * @param uniqueId UUID of a player to display this block to
   * @param soundName The name of the sound effect. For a list, see:
   * https://www.digminecraft.com/lists/sound_list_pc.php
   *
   * Custom sounds can also be played too.
   *
   * @effect This function will add an item to the contract's this.effects
   */
  playSound(uniqueId: string, soundName: string) {
    const effect: MinecraftPlaySoundEffect = {
      type: "MinecraftPlaySoundEffect",
      playerUniqueId: uniqueId,
      soundName: soundName.toLowerCase(),
    };
    this.contractInstance.effects.push(effect);
  }
}

/**
 * The ChatColor values here are named exactly the same as in Spigot/Paper.
 * https://hub.spigotmc.org/javadocs/spigot/org/bukkit/ChatColor.html
 */
export enum ChatColor {
  AQUA = "\u00A7b",
  BLACK = "\u00A70",
  BLUE = "\u00A79",
  BOLD = "\u00A7l",
  DARK_AQUA = "\u00A73",
  DARK_BLUE = "\u00A71",
  DARK_GRAY = "\u00A78",
  DARK_GREEN = "\u00A72",
  DARK_PURPLE = "\u00A75",
  DARK_RED = "\u00A74",
  GOLD = "\u00A76",
  GRAY = "\u00A77",
  GREEN = "\u00A7a",
  ITALIC = "\u00A7o",
  LIGHT_PURPLE = "\u00A7d",
  MAGIC = "\u00A7k",
  RED = "\u00A7c",
  RESET = "\u00A7r",
  STRIKETHROUGH = "\u00A7m",
  UNDERLINE = "\u00A7n",
  WHITE = "\u00A7f",
  YELLOW = "\u00A7e",
}

// Types prefixed with internal in the name are for use with the communications
// to the closed source server system. These are not useful to smart contracts.
type InternalMinecraftPluginArgUniqueID = string;
type InternalMinecraftPluginArgMessage = string;

// Notify a player when something happens
export interface InternalMinecraftPluginNotifyEffect {
  type: "InternalMinecraftPluginNotifyEffect";
  args: [InternalMinecraftPluginArgUniqueID, InternalMinecraftPluginArgMessage];
}

type InternalMinecraftPluginEconomyCategory = "SHOP_SPEND"; // Sent when a player buys something from a shop
type InternalMinecraftPluginEconomyAmount = number;

export interface InternalMinecraftPluginEconomyEffect {
  type: "InternalMinecraftPluginEconomyEffect";
  args: [
    InternalMinecraftPluginArgUniqueID,
    InternalMinecraftPluginEconomyCategory,
    InternalMinecraftPluginEconomyAmount,
  ];
}

export type InternalServerEffect =
  | InternalMinecraftPluginNotifyEffect
  | InternalMinecraftPluginEconomyEffect;

export interface InternalServerTransformResult {
  cancelled: boolean;
  effects: InternalServerEffect[];
}

export const emptyTransformResult: InternalServerTransformResult = {
  cancelled: false,
  effects: [],
};

export interface InternalInputEvent {
  type: `InternalInputEvent`;
  contractTickerSymbol: string;
  event: Event;
}
/**
 * @internal When server sends an event to a smart contract
 */
export type InternalInput = InternalInputEvent;

/**
 * @internal When the proprietary backend messages with SCAngel
 */
export type InternalAngelCommand = {
  type: "InternalAngelCommand";
  subtype: "initialize";
  contractTickerSymbol: string;
  contractCodeFile: string;
  state: any;
} | {
  type: "InternalAngelCommand";
  subtype: "extractState";
} | {
  type: "InternalAngelCommand";
  subtype: "replaceState";
  state: any;
};

/**
 * @internal When SCVirtualMachine2 returns this bootup status. It goes through 2 whole round trips.
 */
export type InternalVMBootupReport = {
  type: "InternalVMBootupReport";
  status: "compileError";
  message: string;
} | {
  type: "InternalVMBootupReport";
  status: "compileSuccess";
} | {
  type: "InternalVMBootupReport";
  status: "testError";
  message: string;
} | {
  type: "InternalVMBootupReport";
  status: "testSuccess";
};

/**
 * @internal When the Angel reports some general message
 */
export type InternalAngelGeneralReport = {
  type: "InternalAngelGeneralReport";
  subtype: "extractState";
  state: any;
};

/**
 * @internal When smart contract emits an event. Filtering of whether a plugin
 * has permission to run an output is handled by the server.
 *
 * Framing is trusted, but result is untrusted.
 */
export interface InternalOutputResult {
  type: `InternalOutputResult`;
  contractTickerSymbol: string;
  result: ContractResult;
}

/**
 * @internal The one and only communication message sent from SCVM to the
 * runtime
 */
export type SCVMMessage = {
  state: Record<string, any>;
  runtimeAction: "stateAndTest";
} | {
  state: Record<string, any>;
  runtimeAction: "replaceState";
} | {
  runtimeAction: "event";
  event: Event;
} | {
  runtimeAction: "extractState";
};
