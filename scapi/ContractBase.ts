/* eslint-disable class-methods-use-this */
import * as scio from "./scioTypes.ts";

export abstract class ContractBase {
  /**
   * A useful API that contains many helpful abstractions.
   */
  api: scio.API;

  constructor(init: scio.ContractInitialization) {
    this.api = new scio.API(init, this);
    // this.state = init.state;
  }

  /**
   * Mutable persistent state is passed into the `Contract` constructor.
   *
   * This is set as readonly to prevent accidents from happening. However, you
   * can actually edit it. You just have to do this incrementally.
   * - To initialize properties: `this.state.foo.bar = {}`
   * - To delete properties, use JavaScript's `delete` operator
   *
   * This state is persisted. However, when the server reboots or your contract
   * crashes spectacularly hard, the state gets serialized to JSON. So don't
   * store any objects that won't survive a JSON round trip.
   */
  state: Record<string, any> = {};

  /**
   * An array of effects that will be passed on to the server after function
   * execution ends. Any type of accept is accepted here, but the server will
   * do additional validation to verify that the contract has permission to run
   * such an effect. If the contract doesn't have permission to run the effect,
   * it will be rejected and the error will be saved in the logs.
   */
  effects: scio.Effect[] = [];

  /**
   * The publicGetState() is the conventional way to expose state to other smart
   * contracts.
   *
   * All class variables and methods are private and can't be accessed by other
   * smart contracts unless you expose them explicitly by adding "public" in
   * front of the execution name/method.
   *
   * Privacy of data is enabled by default. Smart contract execution is
   * airgapped. Security comes from the webworker API from deno that uses V8.
   * In production, smart contracts are also run inside it's own Docker
   * containers for additional security.
   *
   * WARNING: Your contract source code is viewable by all players. To securely
   * store secrets, use this.state and be careful with what you share in
   * publicGetState(). All functions starting with "public" can be called by
   * other smart contracts.
   */
  publicGetState(): Record<string, any> {
    // Return your this.state if you want to publicize everything
    // return this.state

    return {};
  }

  /**
   * Event triggered when player runs a command targeting your organization.
   * This is triggered when:
   *  - Player enters a command into chat: /smartcontract TICKER argument 123
   *  - Player enters a command into chat (shorthand): /sc TICKER argument 123
   * ```
   * Line 1: /smartcontract   <- Must say /smartcontract. /sc is not allowed
   * Line 2: TICKER
   * Line 3: argument 123
   * Line 4: Auth: $150       <- Required in signs. Defaults to $0
   * ```
   *
   * In order to be able to debit money from a player, the command must be
   * triggered from a sign.
   *
   * Arguments from the player are split by spaces.Arguments are case sensitive
   * In the example above, the argument given to the event would be
   * `["argument", "123"]`.
   *
   * To listen to this event, implement `onMinecraftPlayerChatCommandEvent()`
   * in your smart contract class.
   */
  onMinecraftPlayerChatCommandEvent(
    event: scio.MinecraftPlayerChatCommandEvent,
  ): void {}

  /**
   * Event triggered when player runs a command targeting your organization.
   * This is triggered when:
   *  - Player right-clicks a smart contract sign. To create a smart contract
   *    sign, write the smart contract command on the sign. For example:
   * ```
   * Line 1: /smartcontract   <- Must say /smartcontract. /sc is not allowed
   * Line 2: TICKER
   * Line 3: argument 123
   * Line 4: Auth: $150       <- Required in signs. Defaults to $0
   * ```
   *
   * In order to be able to debit money from a player, the command must be
   * triggered from a sign.
   *
   * Arguments from the player are split by spaces.Arguments are case sensitive
   * In the example above, the argument given to the event would be
   * `["argument", "123"]`.
   *
   * To listen to this event, implement `onMinecraftPlayerSignCommandEvent()`
   * in your smart contract class.
   */
  onMinecraftPlayerSignCommandEvent(
    event: scio.MinecraftPlayerSignCommandEvent,
  ): void {}

  /**
   * Event triggered when an arrow that was shot by a player finally hits
   * something. There is no event to listen to when the player actually shoots
   * the arrow.
   *
   * To listen to this event, implement `onMinecraftPlayerArrowLandingEvent()`
   * in your smart contract class.
   */
  onMinecraftPlayerArrowLandingEvent(
    event: scio.MinecraftPlayerArrowLandingEvent,
  ): void {}

  /**
   * Event triggered when a player logs in to the server. There is a two second
   * delay between when the player logs in and the event is sent, in order to
   * reduce lag spikes when a player joins.
   *
   * To listen to this event, implement `onMinecraftPlayerJoinEvent()`
   * in your smart contract class.
   */
  onMinecraftPlayerJoinEvent(event: scio.MinecraftPlayerJoinEvent): void {}

  /**
   * See documentation for MinecraftPlayerMoveEvent for more info.
   *
   * To listen to this event, implement `onMinecraftPlayerMoveEvent()`
   * in your smart contract class.
   */
  onMinecraftPlayerMoveEvent(event: scio.MinecraftPlayerMoveEvent): void {}

  /**
   * If your _test function throws an error, the smart contract will be disabled
   * for safety. Since contracts are deployed atomically, it will not be
   * possible to deploy a contract that fails the test during deployment.
   *
   * In production, _test() will be called with the contract initialized to the
   * actual state in production. This means that _test() is a great place to
   * write unit tests since it will test against production data.
   *
   * Even though SCVM gives a 1000ms timeout deadline, that time is taken up by
   * the compiler and deno. Your tests should run within 10ms.
   */
  _test(): void {
    // throw new Error(
    //   "ContractBase's _test() needs to be overwritten by your smart contract.",
    // );
  }
}
