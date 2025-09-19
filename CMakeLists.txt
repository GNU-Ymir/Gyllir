CMAKE_MINIMUM_REQUIRED(VERSION 3.8)
PROJECT(Midgard C)
SET(CMAKE_C_COMPILER "gyc")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -g")

FILE (
  GLOB_RECURSE
  SRC
  src/*.yr
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
add_executable (gyllir ${SRC})
include_directories(${CMAKE_SOURCE_DIR}/src/)
install (TARGETS gyllir DESTINATION /usr/bin/)
install (FILES ${RES_HTML} DESTINATION /etc/gyllir/res/html/)
install (FILES ${RES_JS} DESTINATION /etc/gyllir/res/js/)
install (FILES ${RES_CSS} DESTINATION /etc/gyllir/res/css/)
install (FILES ${RES_ICO} DESTINATION /etc/gyllir/res/ico/)










