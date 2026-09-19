import type { VariantDef } from "#/prototypes/types";
import { Sheet } from "./sheet";
import { Stepper } from "./stepper";
import { Presets } from "./presets";
import { Inline } from "./inline";
import { Canvas } from "./canvas";

export const variants: VariantDef[] = [
  {
    name: "Sheet",
    axis: "한 장의 다이얼로그에 모든 필드를 펼치고, 요약 한 줄로 결과를 미리 보여줍니다.",
    when: "설정 4개가 전부인데 굳이 단계로 쪼갤 이유가 없을 때.",
    cost: "처음 쓰는 사람은 뭘 골라야 할지 힌트가 적습니다.",
    component: Sheet,
  },
  {
    name: "Stepper",
    axis: "이름·포맷·확인 3단계로 나눠 한 화면에 질문 하나만 둡니다.",
    when: "포맷 선택이 낯선 초심자가 많고, 실수 없이 끝내는 게 중요할 때.",
    cost: "익숙한 사람에게는 클릭 2번이 매번 더 붙습니다.",
    component: Stepper,
  },
  {
    name: "Presets",
    axis: "플랫폼 프리셋 카드가 포맷을 대신 정하고, 사용자는 이름만 칩니다.",
    when: "만드는 영상이 유튜브·릴스·피드처럼 목적지가 뚜렷할 때.",
    cost: "프리셋에 없는 조합은 Advanced를 열어야 해서 한 단계 숨습니다.",
    component: Presets,
  },
  {
    name: "Inline",
    axis: "모달 없이 홈 그리드의 카드가 제자리에서 폼으로 커집니다.",
    when: "새 프로젝트를 자주 만들고, 목록을 보면서 바로 시작하고 싶을 때.",
    cost: "폼이 좁아서 밀도가 높고, 그리드가 재배치되는 움직임이 낯설 수 있습니다.",
    component: Inline,
  },
  {
    name: "Canvas",
    axis: "비율을 숫자가 아니라 눈으로 고릅니다. 큰 프레임이 비율마다 모양을 바꿉니다.",
    when: "영상 만드는 첫 순간에 몰입감과 브랜드 인상을 주고 싶을 때.",
    cost: "화면을 통째로 차지해서 홈 맥락이 사라지고, 정보 밀도는 가장 낮습니다.",
    component: Canvas,
  },
];
