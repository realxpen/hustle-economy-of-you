import {
  CanActivate, ExecutionContext, Injectable, ServiceUnavailableException
} from "@nestjs/common";

/** Fail closed even when the module is compiled. A developer must explicitly
 * enable this only in a disposable environment AFTER the new migration. */
@Injectable()
export class AdaptiveFeatureGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.HUSTLE_ADAPTIVE_CORE_ENABLED !== "true") {
      throw new ServiceUnavailableException(
        "Adaptive backend has not been enabled in this environment"
      );
    }
    return true;
  }
}
