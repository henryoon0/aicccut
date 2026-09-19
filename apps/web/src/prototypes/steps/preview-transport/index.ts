import type { VariantDef } from "#/prototypes/types";
import { Floating } from "./floating";
import { Bar } from "./bar";
import { Minimal } from "./minimal";
import { Pro } from "./pro";
import { Spatial } from "./spatial";

export const variants: VariantDef[] = [
  {
    name: "Floating",
    axis: "컨트롤이 그림 위에 떠 있고, 재생 중 2초 멈추면 사라진다",
    when: "영상 자체를 크게, 방해 없이 보며 편집할 때",
    cost: "컨트롤 위치가 매번 나타나야 해서 손이 기억하기 어렵다",
    component: Floating,
  },
  {
    name: "Bar",
    axis: "캔버스 아래 고정 바, 시간은 왼쪽·재생은 중앙·보기 옵션은 오른쪽",
    when: "매일 쓰는 도구라 모든 버튼의 자리가 늘 같아야 할 때",
    cost: "캔버스 세로 공간을 약 80px 내준다",
    component: Bar,
  },
  {
    name: "Minimal",
    axis: "재생 버튼과 시간만 남기고 나머지는 ••• 메뉴로, 시간을 끌어서 스크럽",
    when: "화면이 작거나 그림에 집중하고 싶을 때",
    cost: "루프·안전영역·배율이 한 단계 숨어서 상태를 한눈에 못 본다",
    component: Minimal,
  },
  {
    name: "Pro",
    axis: "JKL 셔틀, In/Out, 북마크, 프레임 입력, 오디오 미터까지 다 보이는 NLE 문법",
    when: "키보드로 프레임 단위 컷을 많이 잡는 사용자를 위해",
    cost: "처음 보면 버튼이 많아 부담스럽고 밀도가 높다",
    component: Pro,
  },
  {
    name: "Spatial",
    axis: "캔버스가 뷰포트: 휠·핀치 줌, 스페이스 드래그 팬, 눈금자, 도구는 옆 레일에",
    when: "텍스트·로고 위치를 픽셀 단위로 맞추는 작업이 많을 때",
    cost: "스페이스가 팬과 재생을 겸해 처음엔 헷갈릴 수 있다",
    component: Spatial,
    pickerPosition: "top",
  },
];
