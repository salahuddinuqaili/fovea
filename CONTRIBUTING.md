# Contributing

Fovea treats control-plane changes like firmware.

1. Do not widen permissions in a lower policy layer.
2. Add or update evals **and** an operator simulation for every behavioral change.
3. Critical security eval failures cannot be averaged away.
4. Agents may propose kernel changes; they must not deploy them.
5. Run `npm test` and `npm run typecheck` before review.
6. Keep the README written for operators first, contributors second.

