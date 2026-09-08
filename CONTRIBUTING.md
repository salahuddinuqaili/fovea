# Contributing

Fovea treats control-plane changes like firmware.

1. Do not widen permissions in a lower policy layer.
2. Add or update evals **and** an operator simulation for every behavioral change. This tree ships seventeen journeys in `src/kernel/simulations.ts`.
3. Critical security eval failures cannot be averaged away.
4. Agents may propose kernel changes; they must not deploy them.
5. Node 22. Run `npm test` and `npm run typecheck` before review.
6. Keep the README written for operators first, contributors second.

Do not add a global autonomy switch. Do not turn Auth on unless the change explicitly asks for accounts. Production execution stays disabled.

See [SECURITY.md](SECURITY.md) and [ROADMAP.md](ROADMAP.md).
