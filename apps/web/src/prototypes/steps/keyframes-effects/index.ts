import type { VariantDef } from "#/prototypes/types";
import { Diamonds } from "./diamonds";
import { Graph } from "./graph";
import { Stack } from "./stack";
import { Inline } from "./inline";
import { Presets } from "./presets";

export const variants: VariantDef[] = [
  {
    name: "Diamonds",
    axis: "선택한 클립 아래에 속성 레인이 펼쳐지고, 다이아몬드를 끌어 타이밍을 바꾸는 After Effects 방식",
    when: "여러 속성의 타이밍을 한눈에 맞춰야 하는 정밀 편집일 때",
    cost: "타임라인이 세로로 길어지고 처음 보는 사람은 레인·스톱워치 개념을 배워야 함",
    component: Diamonds,
  },
  {
    name: "Graph",
    axis: "값-시간 곡선 에디터가 주무대, 베지어 핸들을 끌어 이징을 직접 조각하고 타임라인은 눈금만",
    when: "움직임의 속도감(가속·감속)까지 손으로 다듬고 싶을 때",
    cost: "패널 하나가 더 필요하고 좌표 읽기가 익숙하지 않으면 어렵게 느껴짐",
    component: Graph,
  },
  {
    name: "Stack",
    axis: "효과를 클립 위 카드 더미로 쌓고, 카드 안에서 파라미터별 애니메이션을 켜서 미니 트랙을 펼침",
    when: "효과의 순서와 켜고 끄기가 키프레임보다 더 자주 쓰이는 작업일 때",
    cost: "카드가 많아지면 패널이 길어지고 시간축이 카드마다 흩어져 전체 타이밍 비교가 어려움",
    component: Stack,
  },
  {
    name: "Inline",
    axis: "값 옆 스톱워치와 그 아래 미니 타임라인만으로 끝, 새 패널 없이 인스펙터 안에서 해결",
    when: "간단한 페이드·이동을 자주 하고 화면을 늘리고 싶지 않을 때",
    cost: "좁은 트랙이라 키프레임이 촘촘하면 잡기 어렵고 여러 속성 간 정렬이 눈에 덜 들어옴",
    component: Inline,
  },
  {
    name: "Presets",
    axis: "모션 프리셋 갤러리가 먼저, 적용하면 실제 키프레임이 생기고 리스트에서 시간·값·이징만 다듬음",
    when: "초보 사용자가 대부분이고 표준 인트로 모션이 80%를 차지할 때",
    cost: "프리셋에 없는 움직임은 리스트로 만들어야 해서 자유도가 낮고 시각적 편집이 약함",
    component: Presets,
  },
];
