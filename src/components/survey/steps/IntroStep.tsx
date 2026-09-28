interface IntroStepProps {
  onStart: () => void;
}

export function IntroStep({ onStart }: IntroStepProps) {
  return (
    <div className="step-card active">
      <div className="hero-step">
        <span className="big-icon">🤖</span>
        <h1>AI Agent로   
          <br />
          무언가 만들고 싶은데   
          <br />
          막막하신가요?</h1>
        <p className="intro-copy">
          개발 경험이 없어도 괜찮아요.<br />
          몇 가지 질문에 답해주시면<br />
          내 프로젝트에 맞는 최적의 개발 환경을 추천해 드립니다.
        </p>
        <div className="hero-chips">
          <span className="chip">🛠️ 도구 추천</span>
          <span className="chip">⚙️ 환경 설정 가이드</span>
          <span className="chip">📄 시작 위치 문서 제공</span>
          <span className="chip">🤖 자동화 방법 안내</span>
        </div>
        <button className="btn btn-primary-solid hero-start" type="button" onClick={onStart}>
          시작하기 →
        </button>
      </div>
    </div>
  );
}
