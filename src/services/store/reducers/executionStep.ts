import {
  isBrick,
  isEast,
  isMarker,
  isNorth,
  isSouth,
  isWall,
} from "../../conditions";
import { doCall } from "../../executor";
import { ASTTest } from "../../parser/types";
import { RootState } from "../types";

/**
 * TODO: fix and improve active line
 */
export function executionStep(state: RootState): void {
  if (state.execution.state === "done") {
    return;
  }

  if (!state.execution.worldOnStart) {
    state.execution.worldOnStart = state.world;
  }

  try {
    while (state.execution.stack.length > 0) {
      const currentFrame = state.execution.stack[0];
      const statement = currentFrame.statements.shift()!;
      state.execution.activeLine = statement.line;

      switch (statement.type) {
        case "call": {
          state.world = doCall(statement, state.world);
          break;
        }
        case "systemCall": {
          switch (statement.action) {
            case "FAST":
              state.execution.speed = "fast";
              currentFrame.statements.unshift({
                type: "systemCall",
                line: statement.line,
                action: "SLOW",
              });
              break;
            case "SLOW":
              state.execution.speed = "slow";
              break;
            case "EXIT":
              state.execution.stack = [];
              break;
            case "FALSE":
              state.execution.stack[1].conditionReturnValue = false;
              break;
            case "TRUE":
              state.execution.stack[1].conditionReturnValue = true;
              break;
          }
          break;
        }
        case "functionCall": {
          const functionCall = state.execution.ast?.functions.find(
            (x) => x.identifier === statement.name
          )!;
          state.execution.stack.unshift({ statements: [...functionCall.body] });
          break;
        }
        case "repeat": {
          if (statement.times > 1) {
            currentFrame.statements.unshift({
              ...statement,
              times: statement.times - 1,
            });
          }
          state.execution.stack.unshift({ statements: [...statement.body] });
          break;
        }
        case "if": {
          const result = evaluateTest(statement.test, state);
          if (typeof result === "object") {
            currentFrame.statements.unshift({
              ...statement,
              test: result,
            });
          } else if (result) {
            currentFrame.statements.unshift(...statement.body);
          } else {
            currentFrame.statements.unshift(...statement.elseBody);
          }
          break;
        }
        case "while": {
          const result = evaluateTest(statement.test, state);

          if (typeof result === "object") {
            currentFrame.statements.unshift({
              type: "if",
              line: statement.line,
              test: result,
              body: [...statement.body, statement],
              elseBody: [],
            });
          } else if (result) {
            currentFrame.statements.unshift(...statement.body, statement);
          }
        }
      }

      while (
        state.execution.stack.length > 0 &&
        state.execution.stack[0].statements.length === 0
      ) {
        state.execution.stack.shift();
      }

      if (state.execution.stack.length === 0) {
        state.execution.state = "done";
      }

      return;
    }
  } catch (e) {
    state.execution.state = "done";

    // TODO: handle error
    console.error(e);
  }
}

export function evaluateTest(
  test: ASTTest,
  state: RootState
): boolean | ASTTest {
  const currentFrame = state.execution.stack[0];

  switch (test.type) {
    case "not": {
      const result = evaluateTest(test.test, state);
      if (typeof result === "object") {
        return {
          type: "not",
          line: test.line,
          test: result,
        };
      } else {
        return !result;
      }
    }
    case "conditionCall": {
      const condition = state.execution.ast?.conditions.find(
        (x) => x.identifier === test.name
      )!;
      currentFrame.conditionReturnValue = undefined;

      state.execution.stack.unshift({ statements: [...condition.body] });
      return {
        type: "state",
        line: test.line,
        state: "CONDITION_RETURN_VALUE",
      };
    }
    case "state": {
      switch (test.state) {
        case "IS_BRICK":
          return isBrick(state.world);
        case "NOT_IS_BRICK":
          return !isBrick(state.world);
        case "IS_MARKER":
          return isMarker(state.world);
        case "NOT_IS_MARKER":
          return !isMarker(state.world);
        case "IS_WALL":
          return isWall(state.world);
        case "NOT_IS_WALL":
          return !isWall(state.world);
        case "IS_EAST":
          return isEast(state.world);
        case "IS_NORTH":
          return isNorth(state.world);
        case "IS_SOUTH":
          return isSouth(state.world);
        case "IS_WEST":
          return isSouth(state.world);
        case "IS_FULL":
          // TODO IS_FULL
          throw new Error("IS_FULL is not implemented yet");
        case "NOT_IS_FULL":
          // TODO NOT_IS_FULL
          throw new Error("NOT_IS_FULL is not implemented yet");
        case "IS_EMPTY":
          // TODO IS_EMPTY
          throw new Error("IS_EMPTY is not implemented yet");
        case "NOT_IS_EMPTY":
          // TODO NOT_IS_EMPTY
          throw new Error("NOT_IS_EMPTY is not implemented yet");
        case "HAS_BRICKS":
          // TODO HAS_BRICKS
          throw new Error("HAS_BRICKS is not implemented yet");
        case "CONDITION_RETURN_VALUE":
          if (state.execution.stack[0].conditionReturnValue === undefined) {
            throw new Error("TODO");
          }
          return state.execution.stack[0].conditionReturnValue;
      }
    }
  }
}
