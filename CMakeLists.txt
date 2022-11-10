CMAKE_MINIMUM_REQUIRED(VERSION 3.1)
PROJECT(Midgard C)
SET(CMAKE_C_COMPILER "gyc")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -g -fno-reflect")

FILE (
  GLOB_RECURSE
  SRC
  src/*.yr
  )

SET_SOURCE_FILES_PROPERTIES(${SRC} PROPERTIES LANGUAGE C)
add_executable (gyllir ${SRC})
include_directories(${CMAKE_SOURCE_DIR}/src/)
install (TARGETS gyllir DESTINATION /usr/bin/)











