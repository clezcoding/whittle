import { Curl } from './Curl'
import { GhostButton, Modal } from './Primitives'
import type { AppInfo, External } from '../types'

export function About({ info, onOpen, onClose }: { info: AppInfo; onOpen: (t: External) => void; onClose: () => void }) {
  return (
    <Modal title="About Whittle" onClose={onClose}>
      <div className="about">
        <Curl className="about__mark" />
        <div>
          <p className="about__name">Whittle <span className="num">{info.version}</span></p>
          <p>A Swiss army knife for your Mac. Finds leftovers, clears caches, tidies folders, and lets you undo it.</p>
        </div>
      </div>
      <dl className="about__facts">
        <div><dt>License</dt><dd>MIT or Apache-2.0, your choice</dd></div>
        <div><dt>Made by</dt><dd>clezcoding by Puzzless Foundation, and contributors</dd></div>
        <div><dt>Privacy</dt><dd>No network access, no analytics. Your data stays on this Mac.</dd></div>
        <div><dt>Typefaces</dt><dd>Switzer (Indian Type Foundry, Fontshare licence) and Geist Mono (SIL OFL)</dd></div>
      </dl>
      <div className="about__links">
        <GhostButton onClick={() => onOpen('repository')}>Source code</GhostButton>
        <GhostButton onClick={() => onOpen('releases')}>Releases</GhostButton>
        <GhostButton onClick={() => onOpen('discussions')}>Discussions</GhostButton>
        <GhostButton onClick={() => onOpen('security')}>Security policy</GhostButton>
      </div>
      <div className="modal__actions">
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
    </Modal>
  )
}
