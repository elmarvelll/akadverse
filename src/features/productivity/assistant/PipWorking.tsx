import { PipAvatar } from "./PipAvatar";

export function PipWorking() {
  return <div role="status" aria-live="polite" className="pip-working">
    <span aria-hidden="true"><PipAvatar/></span>
    <span>PIP is working on your request</span>
    <span className="pip-working-dots" aria-hidden="true"><i/><i/><i/></span>
  </div>;
}
