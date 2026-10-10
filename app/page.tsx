import GameLoader from './game-loader';
export default function Page(){return <>

  <a className="skip" href="#main">Skip to content</a>
  <header className="topbar">
    <a className="brand" href="#home" aria-label="Jom Philosophy home"><span className="brand-icon">j.</span><span>jom<span className="brand-small">philosophy!</span></span></a>
    <nav aria-label="Main navigation"><a href="#home" data-nav="home">Play</a><a href="#live-host" data-nav="live-host">Host live</a><a href="#live-join" data-nav="live-join">Join game</a><a href="#lesson" data-nav="lesson">Class plan</a><a href="#resources" data-nav="resources">Revision kit</a></nav>
    <div className="teacher-tag"><span className="status-dot"></span>with Teacher Reen</div>
  </header>
  <main id="main" tabIndex={-1}></main>
  <footer className="footer"><span>FSPU0012 · Philosophy of Science & Technology</span><span>Good answers have good reasons.</span></footer>
  <div id="toast" role="status" aria-live="polite"></div>
  <dialog id="confirm-dialog"><h2 id="dialog-title">Start again?</h2><p id="dialog-text"></p><div className="button-row"><button data-action="dialog-cancel" className="btn secondary">Keep playing</button><button data-action="dialog-confirm" className="btn dark">Start again</button></div></dialog>
  <GameLoader/>
  <noscript><p className="notice">Please enable JavaScript to play. You can still download <a href="/assets/practice-a.pdf">Practice Set A</a>.</p></noscript>

</>;}
