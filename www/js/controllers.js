angular.module('starter.controllers', ['ionic', 'ngCordova', 'starter.services', 'ngSanitize'])

.controller('mainCtrl', function($rootScope, $scope, $http, $cordovaSQLite, socket, $ionicHistory, $ionicPlatform, socket, $state, $cordovaLocalNotification, $cordovaSplashscreen) {
  
    // navigator.splashscreen.hide();
    userId = window.localStorage.getItem("chatAppId");
    if (!userId);

    $rootScope.badgeNumber = 0;

    //console.log("main controller");
    //console.log(userId);
    $ionicPlatform.ready(function() {
        $http({
            method: "post",
            url: url + "/getData",
            data: {
                userId: userId
            },
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(function(res) {
          console.log(res.data);
            if (res.data == "noUser") {
                window.localStorage.removeItem("chatAppId");
                $cordovaSQLite.execute(db, "DROP TABLE chats");
                $cordovaSQLite.execute(db, "DROP TABLE messages");
                $state.go("agree");

            } else {
                console.log(JSON.stringify(res.data.messages));
                if (res.data.newTopics.length) {
                    for (var i = 0; i < res.data.newTopics.length; i++) {
                        $cordovaSQLite.execute(db, "update chats set joined = ? where topicId = ?", [res.data.newTopics[i].joined, res.data.newTopics[i].topicId]).then(function(result) {

                        }, function(err1) {

                        });

                    }
                }

                if (res.data.messages.length) {
                    // console.log(JSON.stringify(res.data.messages));
                    for (var i = 0; i < res.data.messages.length; i++) {
                        // console.log();
                        // console.log(JSON.stringify(res.data.messages[i].topicId));
                        $cordovaSQLite.execute(db, "INSERT INTO messages (toChat,date,send,how,message) VALUES(?,?,?,?,?)", [res.data.messages[i].topicId, Date.now(), 1, 1, res.data.messages[i].message]).then(function(result) {
                            console.log("inside unread result");
                            // console.log("updation key " + res.data.messages[i].topicId);

                        }, function(err) {

                            console.log("this" + JSON.stringify(err));
                        });

                        $cordovaSQLite.execute(db, "UPDATE chats SET unread = unread + 1 WHERE topicId = ?", [res.data.messages[i].topicId]).then(function(res3) {
                            console.log("UPdate read");
                            console.log(JSON.stringify(res3));
                        }, function(err) {
                            console.log(JSON.stringify(err));
                        });
                    }
                }

                if (res.data.leftChats.length) {
                    for (var i = 0; i < res.data.leftChats.length; i++) {
                        console.log(JSON.stringify(res.data.leftChats[i]));
                        $cordovaSQLite.execute(db, "UPDATE chats set joined = '0' where topicId = ?", [res.data.leftChats[i]]).then(function(result) {}, function(err) {});
                    }
                }
                $cordovaSplashscreen.hide();

                socket.emit("getNotifications",window.localStorage.getItem("chatAppId"));
            }
        }, function(err) {

        });




    });




    // socket handlers

    socket.on("testemit", function(data) {
        //  console.log("setting_socket " + data);
        console.log(JSON.stringify($ionicHistory.currentView()));
    });


    socket.on("sendMessage", function(data) {
        //data = angular.fromJson(data);
        // console.log("*****");
        // console.log(JSON.stringify(data));
        $cordovaSQLite.execute(db, "INSERT INTO messages (toChat,date,send,how,message) VALUES(?,?,?,?,?)", [data.topicId, Date.now(), 1, 1, data.message]).then(function(res) {
            if ($ionicHistory.currentView().stateName == "chat" && $ionicHistory.currentView().stateParams.chatId == data.topicId) {
                $rootScope.$broadcast("newMessage", data);

            } else if ($ionicHistory.currentView().stateName == "tab.chats") {
               $cordovaSQLite.execute(db, "update chats set unread = unread + 1 where topicId = ?", [data.topicId]).then(function(res3) {
                $rootScope.$broadcast("newMessagetoChats", data.topicId);
              });
            } else {
                $cordovaSQLite.execute(db, "update chats set unread = unread + 1 where topicId = ?", [data.topicId]).then(function(res3) {

                    $cordovaLocalNotification.schedule({
                        id: 1,
                        title: "New Message",
                        text: data.message,
                        data: {
                            testData: "value of test Data"
                        }
                    }).then(function(res) {
                        $scope.badgeCount();
                    });

                    $scope.badgeCount();

                });
            }
        }, function(err) {});



    });

    socket.on("needId", function(data) {
        // console.log("registering for id ");
        userId = window.localStorage.getItem("chatAppId");
        if (userId){
            socket.emit("register", userId);
            $rootScope.socketConnect = true;
            console.log("socket registered");
          }else{
            $scope.go("agree");
          }
    });

    socket.on("disconnect",function(){
      $rootScope.socketConnect = false;
      console.log("socket disconnected");
    });

    socket.on("joinTopic", function(data) {
        $cordovaSQLite.execute(db, "update chats set joined = ? where topicId = ?", [data.joined, data.topicId]).then(function(result) {
            if ($ionicHistory.currentView().stateName == "chats") {
                $rootScope.$broadcast("topicJoined", [data.topicId, data.joined]);
            } else {
                $cordovaLocalNotification.schedule({
                    id: 1,
                    title: "New Topic Joined",
                    text: "Hurray!! Someone joined you."

                }).then(function(res) {

                });

            }
        }, function(err1) {

        });

    });

    socket.on("leaveChat", function(data) {

          $cordovaSQLite.execute(db, "update chats set joined = '0' where topicId = ?", [ data]).then(function(result) {
           if ($ionicHistory.currentView().stateName == "chat" && $ionicHistory.currentView().stateParams.chatId == data) {
                $rootScope.$broadcast("topicLeft",{});
              }
           else if($ionicHistory.currentView().stateName == "chats"){
                $rootScope.$broadcast("topicLeftChats",{});
           }else{

           }   
        }, function(err1) {

        });



         

    });


    $scope.badgeCount = function() {
        $cordovaSQLite.execute(db, "select COUNT(*) as c FROM chats where unread > 0").then(function(res) {

            $rootScope.badgeNumber = res.rows.item(0).c;
            // console.log("badge " + $scope.badgeNumber);
        }, function(err) {
            console.log(JSON.stringify(err));
        });
    }


    $ionicPlatform.ready(function() {
        $scope.badgeCount();
    });

    var event1 = $rootScope.$on('$cordovaLocalNotification:click',
        function(event, notification, state) {
            // ...
            //console.log(JSON.stringify(event));
            $state.go("chats");
        });





    $scope.$on('$destroy', function(event) {
        event1();
    });


})

.controller('topicListCtrl', function($scope, $rootScope, $state, $cordovaSQLite, $http) {
    if (!userId)
        userId = window.localStorage.getItem("chatAppId");
    $scope.showSpinner = true;
    $scope.topics = [];
    $scope.category = [];
    $scope.getTopics = function(page) {
        // show the spinner
        //console.log("calling function");
        $scope.showSpinner = true;
        $http({
            method: "post",
            url: url + "/topicList",
            data: {
                page: page,
                category: $scope.category
            },
            headers: {
                'Content-Type': 'application/json'
            }


        }).then(function(res) {
            console.log(userId);
            console.log(JSON.stringify(res));
            res.data.forEach(function(e, i, a) {
                if (e.byUser != userId)
                    $scope.topics.push(e);
                $scope.showSpinner = false;
                //  console.log(e._id);
            });
            //console.log(JSON.stringify($scope.topics));
        }, function(err) {
            // console.log(JSON.stringify(err));
            // handle the error

        });

    };

    $scope.getTopics(1);

    $scope.joinTopic = function(topic) {
        $http({
            method: "post",
            url: url + "/joinTopic",
            data: {
                topicId: topic._id,
                joined: userId
            }


        }).then(function(res) {
            if (res.data != "oops") {
                $cordovaSQLite.execute(db, "INSERT into chats (topicName, joined, unread, topicId) VALUES(?,?,?,?)", [topic.topic, topic.byUser, 0, topic._id]).then(function(result) {
                  $scope.topics.splice($scope.topics.indexOf(topic), 1);
                });
                
            } else {
                // show oops joined by someone else
            }

        }, function(err) {

        });

    }

    $scope.report = function(e) {
        $http({
            method: "post",
            url: url + "/reportTopic",
            data: {
                topicId: e
            },
            headers: {
                'Content-Type': 'application/json'
            }

        }).then(function(res) {

        });
    }
    $scope.goToChats = function() {
        $state.go("tab.chats");
    }




})
    .controller('chatsCtrl', function($rootScope, $state, $scope, $cordovaSQLite, $ionicPlatform, socket, $ionicHistory, $ionicActionSheet, $ionicLoading, $ionicPopup, $http, $cordovaLocalNotification, $cordovaVibration) {
        console.log("chatCtrl");
        $scope.chats = [];

        $scope.updateChats = function() {
          $scope.chats = [];
            $cordovaSQLite.execute(db, "SELECT * FROM chats  order by joined desc , unread desc ").then(function(res) {
                for (var i = 0; i < res.rows.length; i++) {
                    $scope.chats.push(res.rows.item(i));
                    //  console.log(JSON.stringify(res.rows.item(i)));
                }

            }, function(err) {
                console.log(JSON.stringify(err));

            });
        }
        $ionicPlatform.ready(function() {
            $scope.updateChats();
            $cordovaLocalNotification.cancel(1).then(function(res) {});
        });



        // console.log(JSON.stringify($ionicHistory.currentView()));

        $scope.showAction = function(chat) {
            if (chat.joined == '0') {
                var hidesheet = $ionicActionSheet.show({
                    buttons: [{
                        text: "Delete Topic"
                    }, {
                        text: "Clear Messages"
                    }, {
                        text: "Share Chat"
                    }],
                    buttonClicked: function(index) {
                        if (index == 0) {
                            $ionicPopup.confirm({
                                title: "Delete Topic",
                                template: "Are you sure?"
                            }).then(function(confirm) {
                                if (confirm) {
                                    $ionicLoading.show("slow").then(function() {
                                        $http({
                                            method: "post",
                                            url: url + "/deleteTopic",
                                            data: {
                                                userId: userId,
                                                topicId: chat.topicId
                                            },
                                            headers: {
                                                "Content-Type": "application/json"
                                            }
                                        }).then(function(res) {
                                            if (res.data == "success") {
                                                $cordovaSQLite.execute(db, "DELETE  from chats where topicId = ?", [chat.topicId]).then(function(result) {
                                                    $cordovaSQLite.execute(db, "delete  from messages where toChat = ?", [chat.topicId]).then(function(result1) {
                                                        $scope.chats.splice($scope.chats.indexOf(chat), 1);
                                                        $ionicLoading.hide();
                                                    }, function(error1) {
                                                        console.log(JSON.stringify(error1));

                                                    });

                                                }, function(error) {
                                                    console.log(JSON.stringify(error));
                                                });
                                            } else {

                                            }
                                        }, function(err) {

                                        });
                                    })

                                } else {

                                }
                            });

                        } else if (index == 1) {
                            return $scope.deleteMessages(chat);
                        } else {
                            return $scope.shareChat(chat);
                        }

                        return true;
                    }
                });
            } else {
                var hidesheet = $ionicActionSheet.show({
                    buttons: [{
                        text: "Leave Chat"
                    }, {
                        text: "Clear Messages"
                    }, {
                        text: "Share Chat"
                    }],
                    buttonClicked: function(index) {
                        if (index == 0) {
                            $ionicPopup.confirm({
                                title: "Leave Chat",
                                template: "Are you sure?"
                            }).then(function(confirm) {
                                if (confirm) {

                                    $ionicLoading.show("slow").then(function() {
                                        console.log(JSON.stringify(chat));
                                        $http({
                                            method: "post",
                                            url: url + "/leaveChat",
                                            data: {
                                                userId: getUserId(),
                                                topicId: chat.topicId
                                            },
                                            headers: {
                                                "Content-Type": "application/json"
                                            }
                                        }).then(function(res) {
                                            console.log(JSON.stringify(res));
                                            if (res.data == "success") {
                                                $cordovaSQLite.execute(db, "DELETE  from chats where topicId = ?", [chat.topicId]).then(function(result) {
                                                    $cordovaSQLite.execute(db, "delete  from messages where toChat = ?", [chat.topicId]).then(function(result1) {
                                                        $scope.chats.splice($scope.chats.indexOf(chat), 1);
                                                        $ionicLoading.hide();
                                                    }, function(error1) {
                                                        console.log(JSON.stringify(error1));

                                                    });

                                                }, function(error) {
                                                    console.log(JSON.stringify(error));
                                                });

                                            }
                                        }, function(err) {
                                            console.log(JSON.stringify(err));
                                        });
                                    })

                                } else {

                                }
                            });

                        } else if (index == 1) {
                            return $scope.deleteMessages(chat);
                        } else {
                            return $scope.shareChat(chat);
                        }

                        return true;
                    }
                });
            }

        }

        $scope.deleteMessages = function(chat) {
            $ionicPopup.confirm({
                title: "Clear Messages",
                template: "Are You Sure"
            }).then(function(confirm) {
                if (confirm) {
                    $ionicLoading.show("slow").then(function() {
                        $cordovaSQLite.execute(db, "DELETE  from messages where toChat = ?", [chat.topicId]).then(function(res) {

                            $ionicLoading.hide();
                        }, function(err) {
                            console.log(JSON.stringify(err));
                        });
                    });
                } else {


                }
            });
            return true;
        }

        $scope.shareChat = function(chat) {
            // char chat using sharesheet

            return true;
        }

        $scope.goToTopics = function() {
            $state.go("tab.topicList");
        }

        $scope.goToChat = function(chat) {
            if (chat.joined != "0") {
                $state.go("chat", {
                    chatId: chat.topicId
                });
            } else {
                $ionicPopup.alert({
                    title: "<i class = 'icon ion-alert assertive'></i> <b>Ooops</b> <i class = 'icon ion-alert assertive'></i>",
                    template: 'Wait for someone'
                });
            }
        }

        var event = $rootScope.$on("topicJoined", function(event, data) {
          console.log("joned Topic");
            $scope.updateChats();
        });
        var event2 = $rootScope.$on("newMessagetoChats", function(eve, dat) {
            $scope.updateChats();
            if(window.localStorage.getItem("vibrateOnMessageChat"))
              $cordovaVibration.vibrate(1000);
        });

        var event3 = $rootScope.$on("topicLeftChats",function(eve,dat){
          $scope.updateChats();

        });
        //


        $scope.$on("$destroy", function() {
            event();
            event2();
        });




    })

.controller('chatCtrl', function($rootScope, $scope, $stateParams, $cordovaSQLite, $sanitize, $cordovaNetwork, $ionicPlatform, socket, $cordovaLocalNotification, $state) {
   console.log("class status " + JSON.stringify(document.getElementById("chatInputField").classList));
    $scope.joined = false;
    $scope.message = "";
    $scope.chatId = $stateParams.chatId;

    $scope.messages = [];
    // console.log(db);
    //
    $ionicPlatform.ready(function() {
        // check if joined 
        $cordovaSQLite.execute(db, "SELECT * FROM chats WHERE topicId = ?", [$scope.chatId]).then(function(res) {
            // console.log(JSON.stringify(res.rows.item(0)));
            //console.log("joined check ");
            //console.log($scope.chatId);
            //console.log(JSON.stringify(res));
            $scope.joined = res.rows.item(0).joined;
            console.log($scope.joined + " " + userId);


        }, function(err) {
            console.log(JSON.stringify(err));
        });
        $cordovaSQLite.execute(db, "UPDATE chats set unread = 0 where topicId = ?", [$scope.chatId]);

        //

        $cordovaSQLite.execute(db, "SELECT * from messages where toChat = ? order by sno desc limit 0,30 ", [$scope.chatId]).then(function(res) {
            // console.log(JSON.stringify(res));
            //  console.log("fetching messages");
            //console.log(res.rows.length);
            for (var i = 0; i < res.rows.length; i++) {
                $scope.messages.push(res.rows.item(i));
            }

        }, function(err) {
            console.log(JSON.stringify(err));
        });
    });

    $scope.sendMessage = function() {

        // $scope.message = $sanitize($scope.message);
        // console.log($scope.message)
        // console.log('clicked');
        if ($scope.message.length > 0 && $scope.message.length != " ") {
            //console.log("clicked");
            var m = $scope.message;
            $scope.message = "";
            document.getElementById("chatInputField").focus();
            var dt = Date.now();
            $scope.messages.unshift({
                sno: 0,
                toChat: $scope.chatId,
                date: dt,
                send: 0,
                how: 0,
                message: m
            });
            $cordovaSQLite.execute(db, "INSERT INTO messages (toChat,date,send,how,message) VALUES(?,?,?,?,?)", [$scope.chatId, dt, 0, 0, m]).then(function(res) {
                //  console.log(JSON.stringify(res));
                if ($cordovaNetwork.isOnline()) {
                    // send message to server via socket
                    socket.emit('sendMessage', {
                        message: m,
                        byUser: userId,
                        toChat: $scope.joined,
                        topicId: $scope.chatId
                    });
                }

            }, function(err) {
                console.log(JSON.stringify(err))

            });

        }
    }
    $scope.keyPressed = function($event) {
        var keyCode = $event.which || $event.keyCode;
        if (keyCode == 13) {
            $scope.sendMessage();
        }
    }

    $scope.testButton = function() {
        $cordovaLocalNotification.schedule({
            id: 1,
            title: "New Message",
            text: "hey what to do ",
            data: {
                testData: "value of test Data"
            }
        }).then(function(res) {
            console.log(JSON.stringify(res));
        });


    }
    var e = $rootScope.$on("newMessage", function(e, d) {
        $scope.messages.unshift({
            sno: 0,
            toChat: d.topicId,
            date: d.date,
            send: 0,
            how: 1,
            message: d.message
        });

    });

    var e2 = $rootScope.$on("topicLeft",function(e,d){
      $state.go("tab.chats");
    });



     $scope.$on('$destroy', function (event) {
      e();
      e2();
    });

})

.controller('settingsCtrl', function($scope, $ionicHistory, socket, $cordovaNetwork, $http, $cordovaSQLite, $ionicPopup, $state, $cordovaVibration) {
        if (!userId)
            userId = window.localStorage.getItem("chatAppId");
        $scope.setting = {
          vibrate : window.localStorage.getItem("vibrateOnMessageChat")?true:false,
          notification : window.localStorage.getItem("showNotifications")?true:false
        }

        $scope.vibrateChange = function(){
          console.log("changing settings");
          console.log(window.localStorage.getItem("vibrateOnMessageChat"));
          if($scope.setting.vibrate)
              window.localStorage.removeItem("vibrateOnMessageChat");
          else{
              window.localStorage.setItem("vibrateOnMessageChat","true");
              $cordovaVibration.vibrate(200);
            }
        }



        $scope.deleteAccount = function() {
            // console.log("deleting");
          
                //   console.log(JSON.stringify(result));
                

                // sending this data to server 
                if ($cordovaNetwork.isOnline()) {
                    $ionicPopup.confirm({
                        title: "!! DELETE ACCOUNT !! ",
                        template: "Are you sure ??"
                    }).then(function(res) {
                        if (res) {
                            $http({
                                method: "post",
                                url: url + "/deleteAccount",
                                data: {
                                    userId: userId,

                                }
                            }).then(function(res1) {
                                if (res1.data == "success") {
                                    window.localStorage.removeItem("chatAppId");
                                    $cordovaSQLite.execute(db, "DROP TABLE chats");
                                    $cordovaSQLite.execute(db, "DROP TABLE messages");
                                    $state.go("agree");
                                } else {

                                }
                            });

                        } else {

                        }
           
                    });


                }
              }


                
            }).controller('addTopicCtrl', function($rootScope, $scope, $http, $cordovaSQLite, $cordovaNetwork, $ionicLoading) {
                //  console.log("add Topic Ctrl");
                $scope.form = {

                };



                $scope.add = function() {
                    //    console.log("function add");

                    // adding topic
                    $ionicLoading.show();
                    if ($cordovaNetwork.isOnline()) {
                        if ($scope.form.topic.length) {
                            //      console.log("calling");
                            $http({
                                method: "post",
                                url: url + "/addTopic",
                                data: {
                                    byUser: userId,
                                    topic: $scope.form.topic,
                                    category: $scope.form.category
                                },
                                headers: {
                                    'Content-Type': 'application/json'
                                }


                            }).then(function(res) {
                                //        console.log(res.data);
                                $cordovaSQLite.execute(db, "INSERT into chats (topicName, joined, unread, topicId) VALUES(?,?,?,?)", [$scope.form.topic, '0', 0, res.data]).then(function(result) {
                                    $scope.form = {};
                                    $ionicLoading.hide();
                                });

                            }, function(err) {
                                console.log(JSON.stringify(err));
                                $ionicLoading.hide();
                                $ionicPopup.alert({
                                    title: "Error ",
                                    template: 'unexpected error'
                                });
                            });
                        }
                    } else {
                        // you are offline
                    }
                };


            }).controller('agreeCtrl', function($scope, $rootScope, $state, $http, $ionicLoading, $cordovaSQLite, $cordovaDevice, $cordovaSplashscreen, $ionicPlatform, socket) {

                if (window.localStorage.getItem("chatAppId"))
                    $state.go("tab.topicList");
                $ionicPlatform.ready(function() {
                    $cordovaSplashscreen.hide();
                });
                $scope.register = function() {
                    console.log("registering");
                    $ionicLoading.show('slow').then(function() {

                        // console.log("making tables");
                        var query1 = "CREATE TABLE IF NOT EXISTS 'chats' (topicName text, joined text, unread integer, topicId text UNIQUE)";
                        var query2 = "CREATE TABLE IF NOT EXISTS 'messages' (sno integer PRIMARY KEY, toChat integer, date integer, send integer, how integer, message text)";

                        $cordovaSQLite.execute(db, query1).then(function(res) {
                            console.log(JSON.stringify(res));
                        }, function(err) {
                            console.log(JSON.stringify(err));
                        });
                        $cordovaSQLite.execute(db, query2).then(function(res) {
                            console.log(JSON.stringify(res));
                        }, function(err) {
                            console.log(JSON.stringify(err));
                        });



                        // registering to server
                        $http({
                            method: "post",
                            url: url + "/register",
                            data: {
                                uuid: $cordovaDevice.getUUID(),
                                device_token: "null"
                            },
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }).then(function(res) {
                            // console.log("getting id ");

                            window.localStorage.setItem("chatAppId", res.data);
                            userId = res.data;
                            $http({
                                method: "post",
                                url: url + "/getPrevious",
                                data: {
                                    userId: userId
                                },
                                headers: {
                                    'Content-Type': 'application/json'
                                }

                            }).then(function(res1) {
                              userId = window.localStorage.getItem("chatAppId");
                                console.log("inside res1 " + JSON.stringify(res1.data));
                                if (res1.data.length) {
                                    for (var i = 0; i < res1.data.length; i++) {
                                      var joined = (userId == res1.data[i].joined)?res1.data[i].byUser:res1.data[i].joined;
                                      if(!joined)
                                        joined = "0";
                                        $cordovaSQLite.execute(db, "INSERT into chats (topicName, joined, unread, topicId) VALUES(?,?,?,?)", [res1.data[i].topic, joined, 0, res1.data[i]._id]);
                                    }
                                }
                            }, function(res2) {

                            });
                            $ionicLoading.hide();
                           // socket.emit("register", window.localStorage.getItem("chatAppId"));
                            window.localStorage.setItem("vibrateOnMessageChat","true");
                            $state.go("tab.topicList");

                        }, function(err) {
                            console.log(JSON.stringify(err));
                        });

                    });


                }

            }).controller("testCtrl", function($scope, $cordovaSQLite) {
                $scope.data = "click for something";

                $scope.showMessages = function() {
                    $cordovaSQLite.execute(db, "select * from chats").then(function(res) {
                        for (var i = 0; i < res.rows.length; i++) {
                            $scope.data += JSON.stringify(res.rows.item(i));
                        }
                    })
                }
                $scope.showChats = function() {
                    $cordovaSQLite.execute(db, "select * from messages").then(function(res) {
                        for (var i = 0; i < res.rows.length; i++) {
                            $scope.data += JSON.stringify(res.rows.item(i));
                        }
                    })
                }

            }).filter('reverse', function() {
                return function(items) {
                    return items.slice().reverse();
                };
            }).factory('socket', function($rootScope) {
                var socket = io.connect(url);
                var listeners = [];
                return {
                    on: function(eventName, callback) {
                        if (listeners[eventName] == undefined) {
                            socket.on(eventName, function() {
                                var args = arguments;
                                $rootScope.$apply(function() {
                                    callback.apply(socket, args);
                                });
                            });
                            listeners[eventName] = true;
                        }
                    },
                    emit: function(eventName, data, callback) {
                        socket.emit(eventName, data, function() {
                            var args = arguments;
                            $rootScope.$apply(function() {
                                if (callback) {
                                    callback.apply(socket, args);
                                }
                            });
                        })
                    }

                };
            });

            function getUserId() {
                if (!userId)
                    userId = window.localStorage.getItem("chatAppId");
                if (userId)
                    return userId;
                else {


                }


            }