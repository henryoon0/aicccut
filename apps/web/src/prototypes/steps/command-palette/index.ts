import type { VariantDef } from "#/prototypes/types";
import { Spotlight } from "./spotlight";
import { Compact } from "./compact";
import { Grouped } from "./grouped";
import { Learn } from "./learn";
import { Contextual } from "./contextual";

export const variants: VariantDef[] = [
  {
    name: "Spotlight",
    axis: "가운데 큰 검색창 하나, 결과는 영역별 헤더로 묶고 최근 명령을 맨 위에.",
    when: "명령 이름은 대충 알지만 위치와 단축키를 아직 모를 때.",
    cost: "화면을 가리는 크기라 자주 쓰면 방해가 되고, 목록을 읽는 시간이 든다.",
    component: Spotlight,
  },
  {
    name: "Compact",
    axis: "상단바 아래 왼쪽에 붙는 얇은 바, 헤더 없이 8줄, 축약 검색으로 속도 우선.",
    when: "이미 손에 익은 사용자가 하루 수십 번 명령을 부를 때.",
    cost: "처음 배우는 사람에게는 정보가 적고, 화면 왼쪽에 시선이 묶인다.",
    component: Compact,
  },
  {
    name: "Grouped",
    axis: "상단 탭(전체·편집·재생·삽입·파일·보기·최근)으로 영역을 먼저 고르고 그 안에서 검색.",
    when: "명령 수가 늘어나 영역별로 훑어보는 습관을 만들고 싶을 때.",
    cost: "탭 한 번이 더 들어가고, 탭 폭 때문에 영역 이름이 길어질 수 없다.",
    component: Grouped,
  },
  {
    name: "Learn",
    axis: "물음표로 여는 단축키 치트시트가 중심, 그려진 키보드가 검색에 맞춰 불이 켜진다.",
    when: "단축키를 익히는 것이 목표인 신규 사용자와 강의 화면.",
    cost: "레이어가 두 겹(시트 위에 팔레트)이라 처음엔 닫는 순서를 익혀야 한다.",
    component: Learn,
  },
  {
    name: "Contextual",
    axis: "빈 상태가 현재 선택에 맞춰 바뀌고 이유를 한 줄로 설명, 실행 뒤 단축키를 한 번 알려준다.",
    when: "클립을 선택한 채 무엇을 할 수 있는지 바로 알고 싶을 때.",
    cost: "제안 순서가 매번 달라 위치 기억이 어렵고, 규칙을 잘못 잡으면 신뢰를 잃는다.",
    component: Contextual,
  },
];
