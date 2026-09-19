import type { VariantDef } from "#/prototypes/types";
import { Classic } from "./classic";
import { Studio } from "./studio";
import { Focus } from "./focus";
import { Stacked } from "./stacked";
import { Workbench } from "./workbench";

export const variants: VariantDef[] = [
  {
    name: "Classic",
    axis: "4패널 고정 격자, 모든 경계선을 드래그해 크기 조절",
    when: "Premiere·Final Cut에 익숙한 사람이 바로 손에 익어야 할 때",
    cost: "작은 화면에서 패널마다 좁아져 답답함",
    component: Classic,
    hasMotion: false,
  },
  {
    name: "Studio",
    axis: "양쪽 아이콘 레일이 한 번에 하나만 펼치는 플라이아웃",
    when: "미리보기와 타임라인을 크게 쓰고 도구는 필요할 때만 꺼내고 싶을 때",
    cost: "미디어와 속성을 동시에 보기 어려움",
    component: Studio,
  },
  {
    name: "Focus",
    axis: "미리보기가 창 전체, 나머지는 떠다니는 반투명 패널",
    when: "결과물 확인이 우선인 색보정·자막 검수 단계",
    cost: "패널이 화면을 가리고 위치를 매번 정리해야 함",
    component: Focus,
    pickerPosition: "top",
  },
  {
    name: "Stacked",
    axis: "위아래 2단, 아래 도크에서 타임라인·미디어·효과가 탭으로 교대",
    when: "태블릿이나 13인치 노트북처럼 화면이 좁을 때",
    cost: "타임라인을 보면서 미디어를 끌어올 수 없음",
    component: Stacked,
  },
  {
    name: "Workbench",
    axis: "모든 그룹이 탭, 프리셋(Edit·Color·Audio)이 분할 비율을 통째로 바꿈",
    when: "작업 단계마다 다른 배치가 필요하고 사용자가 직접 커스텀하길 원할 때",
    cost: "배치가 자꾸 바뀌어 어디에 뭐가 있는지 기억하기 어려움",
    component: Workbench,
  },
];
