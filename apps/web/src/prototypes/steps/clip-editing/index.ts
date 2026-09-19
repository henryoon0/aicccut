import type { VariantDef } from "#/prototypes/types";
import { Handles } from "./handles";
import { Razor } from "./razor";
import { Gesture } from "./gesture";
import { Contextual } from "./contextual";
import { Precision } from "./precision";

export const variants: VariantDef[] = [
  { name: "Handles", axis: "선택한 클립 양끝에 잡기 핸들이 나타나고, 끌면 델타 칩과 고스트 외곽선이 따라온다", when: "프리미어·파컷 습관이 있는 편집자가 바로 손에 익어야 할 때", cost: "핸들이 작아 짧은 클립에서는 잡기 어렵다", component: Handles, pickerPosition: "top" },
  { name: "Razor", axis: "Select·Razor·Ripple·Slip 도구 모드를 고르면 포인터의 역할이 바뀐다", when: "한 종류의 편집을 연속으로 많이 할 때(컷만 30번 하기)", cost: "모드를 잊으면 엉뚱한 동작이 나온다", component: Razor, pickerPosition: "top" },
  { name: "Gesture", axis: "툴바 없이 마우스를 올린 클립 위에 액션 바가 뜨고, 가장자리가 빛나며, 트림 중 프레임 스트립이 보인다", when: "초보자가 메뉴를 외우지 않고 바로 자르고 지우게 하고 싶을 때", cost: "화면이 자주 움직여 정밀 작업에는 산만하다", component: Gesture, pickerPosition: "top" },
  { name: "Contextual", axis: "우클릭 메뉴가 주 조작면이고 하단 힌트 바가 현재 선택에 맞는 단축키를 가르친다", when: "단축키를 배우게 하면서도 모든 기능을 이름으로 찾게 하고 싶을 때", cost: "매번 메뉴를 열면 클릭 수가 늘어난다", component: Contextual, pickerPosition: "top" },
  { name: "Precision", axis: "클립을 선택하면 트림 패널이 열려 편집점 양쪽 프레임을 크게 보며 프레임 단위로 넛지·숫자 입력·롤 편집한다", when: "말 끝과 컷을 프레임 단위로 맞춰야 하는 강의 영상 마감 때", cost: "패널이 세로 공간을 차지하고 빠른 러프컷에는 과하다", component: Precision, pickerPosition: "top" },
];
