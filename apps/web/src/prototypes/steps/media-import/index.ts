import type { VariantDef } from "#/prototypes/types";
import { Dropzone } from "./dropzone";
import { Inline } from "./inline";
import { Sheet } from "./sheet";
import { Instant } from "./instant";
import { Queue } from "./queue";

export const variants: VariantDef[] = [
  {
    name: "Dropzone",
    axis: "빈 패널 전체가 하나의 점선 드롭 영역, 창 어디든 끌면 전체 화면 오버레이",
    when: "첫 파일을 받는 순간이 가장 중요한 신규 사용자 흐름일 때",
    cost: "패널이 채워진 뒤에는 초대 문구가 사라져 되돌아갈 이유가 약함",
    component: Dropzone,
  },
  {
    name: "Inline",
    axis: "가져오기는 이미 찬 라이브러리 위의 한 줄, 새 파일은 스켈레톤 카드가 제자리에서 채워짐",
    when: "매일 수십 번 가져오는 숙련 사용자라 화면 전환이 부담일 때",
    cost: "파일 정보나 옵션을 확인할 자리가 없어 실수를 미리 못 잡음",
    component: Inline,
  },
  {
    name: "Sheet",
    axis: "가져오기 전에 다이얼로그에서 파일 표를 검토하고 프록시·타임라인 옵션을 고름",
    when: "4K 원본처럼 파일이 크고 프록시 결정을 미리 해야 할 때",
    cost: "클릭이 2번 늘고, 작은 파일 하나 넣을 때도 방이 열려 무겁게 느껴짐",
    component: Sheet,
  },
  {
    name: "Instant",
    axis: "라이브러리를 거치지 않고 재생 헤드 위치로 바로 놓임, 유령 클립이 날아가 안착",
    when: "촬영본 순서대로 빠르게 이어 붙이는 러프 컷 단계일 때",
    cost: "의도치 않은 위치에 놓이면 되돌리기에 의존, 오디오는 별도 처리",
    component: Instant,
  },
  {
    name: "Queue",
    axis: "우하단 토스트 스택에서 진행 상황을 보여주고 편집기는 계속 쓸 수 있음",
    when: "수 GB 파일을 여러 개 넣어 몇 분씩 걸리는 작업이 흔할 때",
    cost: "스택이 시야 구석에 있어 완료를 놓치기 쉽고, 카드가 쌓이면 정리가 필요함",
    component: Queue,
    pickerPosition: "top",
  },
];
