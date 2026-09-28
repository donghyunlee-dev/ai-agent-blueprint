const steps = [
  {
    num: "01",
    title: "서비스 목적 입력",
    desc: "무엇을 만들고 싶은지, 어떤 문제를 해결하고 싶은지 간단히 입력합니다.",
  },
  {
    num: "02",
    title: "실행 환경 선택",
    desc: "웹, PC 앱, 팀 규모, 운영체제 등 실제 사용 환경을 선택합니다.",
  },
  {
    num: "03",
    title: "데이터·보안 설정",
    desc: "DB, 로그인, 알림, 배포, 보안 요구사항을 단계적으로 수집합니다.",
  },
  {
    num: "04",
    title: "추천 결과 확인",
    desc: "수집된 요구사항을 바탕으로 권장 스택, 연동 도구, 체크리스트를 생성합니다.",
  },
];

export function HomeHowItWorks() {
  return (
    <section className="how" id="how">
      <span className="section-eyebrow reveal">HOW IT WORKS</span>
      <h2 className="section-title reveal">몇 가지 질문만으로 설계합니다</h2>
      <p className="section-desc reveal">
        설문은 비개발자도 답할 수 있게 구성되어 있고, 결과는 개발자가 바로 이어받을 수 있게 정리됩니다.
      </p>

      <div className="steps-grid">
        {steps.map((step) => (
          <article className="step-card-home reveal" key={step.num}>
            <span className="step-num">{step.num}</span>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

