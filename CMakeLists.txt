CMAKE_MINIMUM_REQUIRED(VERSION 3.1)
PROJECT(Midgard C)
set(CMAKE_YMIR_COMPILER "/home/emile/ymir/bootstrap/gyc/gcc-install/bin/gyc")
set(CMAKE_YMIR_RELEASE_FLAGS "-fPIC" "-O3" "-fv" "-fdoc" "out.json" "-fdump-ymir")
set(CMAKE_YMIR_DEBUG_FLAGS "${CMAKE_YMIR_RELEASE_FLAGS}" "-fversion=DEBUG_LIB" "-g")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -g")

FILE (
  GLOB_RECURSE
  SRC
  src/main.yr
  )

FILE (
  GLOB_RECURSE
  RES_HTML
  res/html/*
  )

FILE (
  GLOB_RECURSE
  RES_JS
  res/js/*
  )

FILE (
  GLOB_RECURSE
  RES_ICO
  res/ico/*
  )

FILE (
  GLOB_RECURSE
  RES_CSS
  res/css/*
  )

SET_SOURCE_FILES_PROPERTIES(${SRC} PROPERTIES LANGUAGE C)
add_custom_target (gyllir ALL
  COMMENT "Building gyllir"
  COMMAND ${CMAKE_YMIR_COMPILER} ${CMAKE_YMIR_DEBUG_FLAGS} ${CMAKE_CURRENT_SOURCE_DIR}/src/main.yr -o ${CMAKE_CURRENT_BINARY_DIR}/gyllir
)

install (FILES ${CMAKE_CURRENT_BINARY_DIR}/gyllir DESTINATION /usr/bin/)
install (FILES ${RES_HTML} DESTINATION /etc/gyllir/res/html/)
install (FILES ${RES_JS} DESTINATION /etc/gyllir/res/js/)
install (FILES ${RES_CSS} DESTINATION /etc/gyllir/res/css/)
install (FILES ${RES_ICO} DESTINATION /etc/gyllir/res/ico/)










