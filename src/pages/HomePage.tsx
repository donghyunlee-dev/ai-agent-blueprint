import "../styles/home.css";

export function HomePage() {
  return (
    <div className="home-shell">
      <header className="home-shell-header">
        <div className="home-shell-brand">
          <span className="home-shell-mark" aria-hidden="true">W</span>
          <span>Windsoft Blueprint</span>
        </div>
      </header>
      <main className="home-shell-main">
        <section className="home-shell-intro" aria-labelledby="home-shell-title">
          <p className="home-shell-eyebrow">PRODUCT BLUEPRINT</p>
          <h1 id="home-shell-title">새 Blueprint 시작</h1>
          <p>아이디어를 검토 가능한 제품 계획으로 구체화하는 공간입니다.</p>
        </section>
        <section className="home-shell-empty" aria-labelledby="home-shell-empty-title">
          <span className="home-shell-empty-mark" aria-hidden="true">＋</span>
          <h2 id="home-shell-empty-title">프로젝트 시작 화면을 준비하고 있습니다</h2>
          <p>새 Blueprint와 최근 프로젝트 기능이 준비되면 이곳에서 이어서 작업할 수 있습니다.</p>
        </section>
      </main>
    </div>
  );
}
