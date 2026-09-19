import type { VariantDef } from "#/prototypes/types";
import { Sections } from "./sections";
import { TabsVariant } from "./tabs";
import { Compact } from "./compact";
import { Cards } from "./cards";
import { Contextual } from "./contextual";

export const variants: VariantDef[] = [
  {
    name: "Sections",
    axis: "아코디언으로 섹션을 접고 펴며, 라벨 왼쪽·값 오른쪽 한 줄 구조",
    when: "속성이 많아도 한 패널에서 스크롤로 다 보고 싶을 때",
    cost: "접힌 섹션 안의 값은 열어야 보이고, 헤더 줄이 자리를 차지함",
    component: Sections,
  },
  {
    name: "Tabs",
    axis: "Layout·Style·Text 세 페이지로 나눠 스크롤 대신 탭 전환",
    when: "패널 높이가 낮은 화면에서 한 페이지를 한눈에 보고 싶을 때",
    cost: "다른 페이지 값은 안 보이고, 클릭이 한 번 더 필요함",
    component: TabsVariant,
  },
  {
    name: "Compact",
    axis: "28px 컴팩트 사이즈, 2열 숫자 격자, 아이콘 라벨과 툴팁으로 최대 밀도",
    when: "Figma에 익숙하고 한 화면에 모든 값을 두고 빠르게 손보고 싶을 때",
    cost: "아이콘 뜻을 외워야 하고, 처음 쓰는 사람은 툴팁에 의존함",
    component: Compact,
  },
  {
    name: "Cards",
    axis: "섹션마다 떠 있는 카드, 슬라이더와 큰 색상 스와치로 여유 있게",
    when: "마우스로 감을 잡으며 조절하는 편집자, 초보자가 많을 때",
    cost: "세로 길이가 길어 스크롤이 잦고, 정밀 입력은 한 단계 더 걸림",
    component: Cards,
  },
  {
    name: "Contextual",
    axis: "검색으로 속성을 찾고, 선택 종류에 따라 섹션 순서가 바뀌고, 최근 수정이 위에 고정",
    when: "속성이 수십 개로 늘어나도 자주 쓰는 것만 손 닿는 곳에 두고 싶을 때",
    cost: "위치가 매번 바뀌어 근육 기억이 안 생기고, 규칙을 설명해야 함",
    component: Contextual,
  },
];
